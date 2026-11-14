import type { Coordinate } from 'ol/coordinate'

import { fromLonLat } from 'ol/proj'

import type { LineId } from '@/data/lines'
import type { PlaceDefinition } from '@/data/places'

import { MAP_PROJECTION } from '@/map/config'

import type { ResolvedLine } from './lines'

import { closestPosition, distanceMeters } from './geometry'

/** A place further than this from every line is a mistake in the place list. */
const MAX_PLACE_DISTANCE_METERS = 150

/** Lines pass through the same point if they come this close; on a shared track their coordinates are identical. */
const SAME_POINT_METERS = 1

/** A point on the network and the lines passing through it. */
export interface LinePosition {
	/** Point on the network in the map projection. */
	readonly coordinate: Coordinate
	/** Distance from the query point in meters. */
	readonly distanceMeters: number
	/** Lines passing through the point, in the order of the line list. */
	readonly lineIds: readonly LineId[]
}

export interface ResolvedPlace {
	readonly definition: PlaceDefinition
	/** Point on the network in the map projection. */
	readonly coordinate: Coordinate
	/** Lines passing through the place, in the order of the line list. */
	readonly lineIds: readonly LineId[]
}

/** The point on the network closest to `point` (map projection), and every line that passes through it. */
export function closestOnLines (lines: readonly ResolvedLine[], point: Coordinate): LinePosition | undefined {
	const candidates = lines.map(line => ({ lineId: line.definition.id, position: closestPosition(line.coordinates, point) }))
	let best = candidates[0]
	for (const candidate of candidates) {
		if (best && candidate.position.distanceMeters < best.position.distanceMeters) {
			best = candidate
		}
	}
	if (!best) {
		return undefined
	}
	const { coordinate } = best.position
	const lineIds = candidates
		.filter(({ position }) => distanceMeters(position.coordinate, coordinate) < SAME_POINT_METERS)
		.map(({ lineId }) => lineId)
	return { coordinate, distanceMeters: best.position.distanceMeters, lineIds }
}

/** Moves a place onto the nearest line and finds every line that passes through it. */
export function resolvePlace (lines: readonly ResolvedLine[], definition: PlaceDefinition): ResolvedPlace {
	const position = closestOnLines(lines, fromLonLat(definition.coordinate, MAP_PROJECTION))
	if (!position || position.distanceMeters > MAX_PLACE_DISTANCE_METERS) {
		throw new Error(`The place "${definition.name}" is not on any line.`)
	}
	return { definition, coordinate: position.coordinate, lineIds: position.lineIds }
}
