import type { Coordinate } from 'ol/coordinate'

import type { LineId } from '@/data/lines'
import type { ResolvedLine } from '@/network/lines'

import { closestPosition, polylineLengthMeters, positionIndex, subPolyline } from '@/network/geometry'
import { findShortestPath, itemAt, type Network, type NetworkEdge } from '@/network/graph'

/** A ride on one line without a change. */
export interface RouteLeg {
	readonly lineId: LineId
	/** Coordinates in the direction of travel, in the map projection. */
	readonly coordinates: readonly Coordinate[]
	readonly lengthMeters: number
}

/** A ride from start to destination; between two legs, the passenger changes lines. */
export interface Route {
	readonly legs: readonly RouteLeg[]
	readonly lengthMeters: number
}

/** A stretch of one network edge on the way, in the direction of travel. */
interface Piece {
	readonly edgeId: number
	readonly coordinates: readonly Coordinate[]
	readonly lengthMeters: number
}

/** A point on the track: an edge that a line runs on, and the fractional vertex index on that edge. */
interface TrackPosition {
	readonly edgeId: number
	readonly index: number
}

/** Pieces shorter than this (a start exactly on a junction) are dropped. */
const MIN_PIECE_METERS = 0.01

/** The lines on each edge, in the order of the line list. */
function linesByEdge (lines: readonly ResolvedLine[]): Map<number, LineId[]> {
	const result = new Map<number, LineId[]>()
	for (const line of lines) {
		for (const edgeId of line.path.edgeIds) {
			result.set(edgeId, [...result.get(edgeId) ?? [], line.definition.id])
		}
	}
	return result
}

function locate (network: Network, edgeIds: Iterable<number>, coordinate: Coordinate): TrackPosition {
	let best: { edgeId: number, index: number, distance: number } | undefined
	for (const edgeId of edgeIds) {
		const position = closestPosition(itemAt(network.edges, edgeId).coordinates, coordinate)
		if (!best || position.distanceMeters < best.distance) {
			best = { edgeId, index: positionIndex(position), distance: position.distanceMeters }
		}
	}
	if (!best) {
		throw new Error('Im Netz fährt keine Linie.')
	}
	return best
}

function lastIndex (edge: NetworkEdge): number {
	return edge.coordinates.length - 1
}

function piece (network: Network, edgeId: number, from: number, to: number): Piece {
	const coordinates = subPolyline(itemAt(network.edges, edgeId).coordinates, from, to)
	return { edgeId, coordinates, lengthMeters: polylineLengthMeters(coordinates) }
}

function totalLength (pieces: readonly Piece[]): number {
	return pieces.reduce((sum, { lengthMeters }) => sum + lengthMeters, 0)
}

/**
 * The shortest way along the track: leave the start's edge at either end, take the shortest path between
 * the edges (Dijkstra), and enter the destination's edge at either end; or stay on the edge if both lie on
 * the same one. The track the lines use is a tree, so this way is the only one without turning back.
 */
function trackPieces (network: Network, edgeIds: ReadonlySet<number>, start: TrackPosition, destination: TrackPosition): Piece[] | undefined {
	const startEdge = itemAt(network.edges, start.edgeId)
	const destinationEdge = itemAt(network.edges, destination.edgeId)
	const candidates: Piece[][] = []
	if (start.edgeId === destination.edgeId) {
		candidates.push([piece(network, start.edgeId, start.index, destination.index)])
	}
	for (const [exitNode, exitIndex] of [[startEdge.from, 0], [startEdge.to, lastIndex(startEdge)]] as const) {
		for (const [entryNode, entryIndex] of [[destinationEdge.from, 0], [destinationEdge.to, lastIndex(destinationEdge)]] as const) {
			const path = findShortestPath(network, exitNode, entryNode, edge => edgeIds.has(edge.id))
			if (!path) {
				continue
			}
			const middle = path.edgeIds.map((edgeId, step) => {
				const edge = itemAt(network.edges, edgeId)
				const forward = edge.from === itemAt(path.nodeIds, step)
				return piece(network, edgeId, forward ? 0 : lastIndex(edge), forward ? lastIndex(edge) : 0)
			})
			candidates.push([
				piece(network, start.edgeId, start.index, exitIndex),
				...middle,
				piece(network, destination.edgeId, entryIndex, destination.index),
			])
		}
	}
	let best: Piece[] | undefined
	for (const candidate of candidates) {
		if (!best || totalLength(candidate) < totalLength(best)) {
			best = candidate
		}
	}
	return best?.filter(({ lengthMeters }) => lengthMeters >= MIN_PIECE_METERS)
}

function joinPieces (pieces: readonly Piece[]): Coordinate[] {
	const coordinates: Coordinate[] = []
	for (const { coordinates: part } of pieces) {
		// Consecutive pieces meet in the same node coordinate.
		coordinates.push(...(coordinates.length === 0 ? part : part.slice(1)))
	}
	return coordinates
}

/**
 * The fewest changes along a fixed way: from the current piece, ride the line that follows the way
 * furthest, change there to the line that goes furthest from that point, and so on. This greedy choice
 * gives the smallest number of changes, and each change happens where the previous line turns off.
 */
function legsAlong (pieces: readonly Piece[], lineIds: ReadonlyMap<number, readonly LineId[]>): RouteLeg[] | undefined {
	const legs: RouteLeg[] = []
	let first = 0
	while (first < pieces.length) {
		let best: { lineId: LineId, end: number } | undefined
		for (const lineId of lineIds.get(itemAt(pieces, first).edgeId) ?? []) {
			let end = first
			while (end < pieces.length && (lineIds.get(itemAt(pieces, end).edgeId) ?? []).includes(lineId)) {
				end++
			}
			if (!best || end > best.end) {
				best = { lineId, end }
			}
		}
		if (!best) {
			return undefined
		}
		const legPieces = pieces.slice(first, best.end)
		legs.push({ lineId: best.lineId, coordinates: joinPieces(legPieces), lengthMeters: totalLength(legPieces) })
		first = best.end
	}
	return legs
}

/**
 * The route between two points on the lines (map projection): the shortest way along the track, ridden with
 * the fewest changes. Undefined if no line connects them.
 */
export function findRoute (network: Network, lines: readonly ResolvedLine[], start: Coordinate, destination: Coordinate): Route | undefined {
	const lineIds = linesByEdge(lines)
	const edgeIds = new Set(lineIds.keys())
	const pieces = trackPieces(network, edgeIds, locate(network, edgeIds, start), locate(network, edgeIds, destination))
	const legs = pieces && pieces.length > 0 ? legsAlong(pieces, lineIds) : undefined
	return legs ? { legs, lengthMeters: legs.reduce((sum, leg) => sum + leg.lengthMeters, 0) } : undefined
}
