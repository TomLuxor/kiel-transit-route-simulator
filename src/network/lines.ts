import type { Coordinate } from 'ol/coordinate'

import { fromLonLat } from 'ol/proj'

import type { LineDefinition } from '@/data/lines'

import { MAP_PROJECTION } from '@/map/config'

import { type Network, nearestNode, type NetworkPath, pathCoordinates, pathThrough } from './graph'

/** A waypoint further than this from every node is a mistake in the line definition, not a rounding issue. */
const MAX_WAYPOINT_DISTANCE_METERS = 100

export interface ResolvedLine {
	readonly definition: LineDefinition
	readonly path: NetworkPath
	/** Coordinates of the whole line in the map projection, from the first waypoint to the last. */
	readonly coordinates: readonly Coordinate[]
}

/** Lays a line onto the network: the shortest path through the nodes nearest to its waypoints. */
export function resolveLine (network: Network, definition: LineDefinition): ResolvedLine {
	const nodeIds = definition.waypoints.map(waypoint => {
		const { node, distanceMeters } = nearestNode(network, fromLonLat(waypoint, MAP_PROJECTION))
		if (distanceMeters > MAX_WAYPOINT_DISTANCE_METERS) {
			throw new Error(`${definition.name}: Der Wegpunkt ${waypoint.join(', ')} liegt ${String(Math.round(distanceMeters))} m neben dem Netz.`)
		}
		return node.id
	})
	const path = pathThrough(network, nodeIds)
	if (!path) {
		throw new Error(`${definition.name}: Die Wegpunkte sind im Netz nicht verbunden.`)
	}
	return { definition, path, coordinates: pathCoordinates(network, path) }
}
