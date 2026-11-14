import type { Coordinate } from 'ol/coordinate'

import { closestPosition, distanceMeters, pairs, polylineLengthMeters, type PolylinePosition, splitPolyline } from './geometry'

/** A polyline from the WFS, in the map projection. */
export interface NetworkPart {
	readonly sectionId: number
	readonly coordinates: readonly Coordinate[]
}

export interface NetworkNode {
	readonly id: number
	readonly coordinate: Coordinate
}

export interface NetworkEdge {
	readonly id: number
	readonly from: number
	readonly to: number
	/** Coordinates from node `from` to node `to`, in the map projection. */
	readonly coordinates: readonly Coordinate[]
	readonly lengthMeters: number
	/** WFS feature the edge comes from. */
	readonly sectionId: number
}

export interface Network {
	/** Node IDs and edge IDs are their indices in these arrays. */
	readonly nodes: readonly NetworkNode[]
	readonly edges: readonly NetworkEdge[]
	readonly edgesByNode: ReadonlyMap<number, readonly number[]>
}

export interface NetworkPath {
	readonly nodeIds: readonly number[]
	readonly edgeIds: readonly number[]
	readonly lengthMeters: number
}

/**
 * Ends closer than this are joined. The largest real gap between sections that should meet is about
 * 50 m (end of Abschnitt 6 at Ziegelteich), the smallest distance between ends that must stay apart is
 * far above 100 m.
 */
export const DEFAULT_TOLERANCE_METERS = 60

/** Array access that fails loudly; node and edge IDs are indices, so a miss is a programming error. */
export function itemAt<T> (items: readonly T[], index: number): T {
	const item = items[index]
	if (item === undefined) {
		throw new Error(`Kein Element an Position ${String(index)}.`)
	}
	return item
}

function endsOf (coordinates: readonly Coordinate[]): [Coordinate, Coordinate] {
	return [itemAt(coordinates, 0), itemAt(coordinates, coordinates.length - 1)]
}

/**
 * Splits every part where the end of another part touches its interior. Three lines branch off in the
 * middle of a WFS feature (Torfende, Tiefe Allee, Berufsbildungszentrum Gaarden), so joining ends alone
 * would leave those branches unconnected.
 */
function splitAtJunctions (parts: readonly NetworkPart[], toleranceMeters: number): NetworkPart[] {
	const splits: PolylinePosition[][] = parts.map(() => [])
	for (const [index, part] of parts.entries()) {
		for (const end of endsOf(part.coordinates)) {
			for (const [otherIndex, other] of parts.entries()) {
				if (otherIndex === index) {
					continue
				}
				const position = closestPosition(other.coordinates, end)
				const [otherStart, otherEnd] = endsOf(other.coordinates)
				const inInterior = distanceMeters(position.coordinate, otherStart) > toleranceMeters &&
					distanceMeters(position.coordinate, otherEnd) > toleranceMeters
				if (position.distanceMeters <= toleranceMeters && inInterior) {
					itemAt(splits, otherIndex).push(position)
				}
			}
		}
	}
	return parts.flatMap((part, index) => splitPolyline(part.coordinates, itemAt(splits, index))
		.map(coordinates => ({ sectionId: part.sectionId, coordinates })))
}

/** The point of a group with the smallest total distance to the others, so that a node lies on one of the lines. */
function medoid (points: readonly Coordinate[]): Coordinate {
	let best = itemAt(points, 0)
	let bestSum = Infinity
	for (const candidate of points) {
		const sum = points.reduce((total, point) => total + distanceMeters(candidate, point), 0)
		if (sum < bestSum) {
			best = candidate
			bestSum = sum
		}
	}
	return best
}

/** Groups the ends of all pieces that lie within the tolerance of each other; each group becomes a node. */
function clusterEnds (pieces: readonly NetworkPart[], toleranceMeters: number): { nodes: NetworkNode[], nodeOfEnd: number[] } {
	// Ends of piece i are at 2i (start) and 2i + 1 (end).
	const ends = pieces.flatMap(piece => endsOf(piece.coordinates))
	const parent = ends.map((_, index) => index)
	const root = (index: number): number => {
		let current = index
		while (itemAt(parent, current) !== current) {
			current = itemAt(parent, current)
		}
		return current
	}
	for (const [index, end] of ends.entries()) {
		for (let other = index + 1; other < ends.length; other++) {
			if (distanceMeters(end, itemAt(ends, other)) <= toleranceMeters) {
				parent[root(other)] = root(index)
			}
		}
	}

	const groups = new Map<number, number[]>()
	for (const index of ends.keys()) {
		const group = groups.get(root(index)) ?? []
		group.push(index)
		groups.set(root(index), group)
	}
	const nodes: NetworkNode[] = []
	const nodeOfEnd = ends.map(() => -1)
	for (const members of groups.values()) {
		const id = nodes.length
		nodes.push({ id, coordinate: medoid(members.map(member => itemAt(ends, member))) })
		for (const member of members) {
			nodeOfEnd[member] = id
		}
	}
	return { nodes, nodeOfEnd }
}

/** Adds the node coordinates at both ends where a piece stops short of its node (for example the gap at Ziegelteich). */
function connectToNodes (coordinates: readonly Coordinate[], start: Coordinate, end: Coordinate): Coordinate[] {
	const [first, last] = endsOf(coordinates)
	return [
		...(distanceMeters(first, start) > 0.01 ? [start] : []),
		...coordinates,
		...(distanceMeters(last, end) > 0.01 ? [end] : []),
	]
}

/** Builds the network graph: nodes at ends and junctions, edges along the lines between them. */
export function buildNetwork (parts: readonly NetworkPart[], toleranceMeters = DEFAULT_TOLERANCE_METERS): Network {
	const pieces = splitAtJunctions(parts, toleranceMeters)
	const { nodes, nodeOfEnd } = clusterEnds(pieces, toleranceMeters)

	const edges: NetworkEdge[] = []
	const edgesByNode = new Map<number, number[]>()
	for (const [index, piece] of pieces.entries()) {
		const from = itemAt(nodeOfEnd, 2 * index)
		const to = itemAt(nodeOfEnd, 2 * index + 1)
		// Both ends at the same node: a short connector inside a junction. It can never shorten a path.
		if (from === to) {
			continue
		}
		const coordinates = connectToNodes(piece.coordinates, itemAt(nodes, from).coordinate, itemAt(nodes, to).coordinate)
		const edge: NetworkEdge = { id: edges.length, from, to, coordinates, lengthMeters: polylineLengthMeters(coordinates), sectionId: piece.sectionId }
		edges.push(edge)
		for (const node of [from, to]) {
			edgesByNode.set(node, [...edgesByNode.get(node) ?? [], edge.id])
		}
	}
	return { nodes, edges, edgesByNode }
}

/** The node closest to `coordinate` (map projection), with its distance in meters. */
export function nearestNode (network: Network, coordinate: Coordinate): { node: NetworkNode, distanceMeters: number } {
	let best: { node: NetworkNode, distanceMeters: number } | undefined
	for (const node of network.nodes) {
		const distance = distanceMeters(coordinate, node.coordinate)
		if (!best || distance < best.distanceMeters) {
			best = { node, distanceMeters: distance }
		}
	}
	if (!best) {
		throw new Error('Das Netz hat keine Knoten.')
	}
	return best
}

/** Dijkstra's algorithm; `isUsable` can exclude edges. Returns undefined if `to` cannot be reached. */
export function findShortestPath (
	network: Network,
	from: number,
	to: number,
	isUsable: (edge: NetworkEdge) => boolean = () => true,
): NetworkPath | undefined {
	const distances = new Map<number, number>([[from, 0]])
	const previous = new Map<number, { node: number, edge: number }>()
	const settled = new Set<number>()

	for (;;) {
		let current: number | undefined
		let currentDistance = Infinity
		for (const [node, distance] of distances) {
			if (!settled.has(node) && distance < currentDistance) {
				current = node
				currentDistance = distance
			}
		}
		if (current === undefined) {
			return undefined
		}
		if (current === to) {
			break
		}
		settled.add(current)
		for (const edgeId of network.edgesByNode.get(current) ?? []) {
			const edge = itemAt(network.edges, edgeId)
			if (!isUsable(edge)) {
				continue
			}
			const neighbor = edge.from === current ? edge.to : edge.from
			const distance = currentDistance + edge.lengthMeters
			if (distance < (distances.get(neighbor) ?? Infinity)) {
				distances.set(neighbor, distance)
				previous.set(neighbor, { node: current, edge: edgeId })
			}
		}
	}

	const nodeIds = [to]
	const edgeIds: number[] = []
	for (let step = previous.get(to); step; step = previous.get(step.node)) {
		nodeIds.unshift(step.node)
		edgeIds.unshift(step.edge)
	}
	return { nodeIds, edgeIds, lengthMeters: distances.get(to) ?? 0 }
}

/** Joins two paths where the first ends and the second starts. */
export function concatPaths (first: NetworkPath, second: NetworkPath): NetworkPath {
	return {
		nodeIds: [...first.nodeIds, ...second.nodeIds.slice(1)],
		edgeIds: [...first.edgeIds, ...second.edgeIds],
		lengthMeters: first.lengthMeters + second.lengthMeters,
	}
}

/** The coordinates along a path, each edge in the direction it is travelled. */
export function pathCoordinates (network: Network, path: NetworkPath): Coordinate[] {
	const result: Coordinate[] = []
	for (const [index, edgeId] of path.edgeIds.entries()) {
		const edge = itemAt(network.edges, edgeId)
		const forward = edge.from === itemAt(path.nodeIds, index)
		const coordinates = forward ? edge.coordinates : [...edge.coordinates].reverse()
		result.push(...(result.length === 0 ? coordinates : coordinates.slice(1)))
	}
	return result
}

/** Shortest path through a list of nodes, visiting them in order. */
export function pathThrough (network: Network, nodeIds: readonly number[]): NetworkPath | undefined {
	let path: NetworkPath = { nodeIds: [itemAt(nodeIds, 0)], edgeIds: [], lengthMeters: 0 }
	for (const [from, to] of pairs(nodeIds)) {
		const leg = findShortestPath(network, from, to)
		if (!leg) {
			return undefined
		}
		path = concatPaths(path, leg)
	}
	return path
}
