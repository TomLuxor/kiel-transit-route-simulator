import type { Coordinate } from 'ol/coordinate'

import { fromLonLat } from 'ol/proj'

import type { LineId } from '@/data/lines'
import type { PlaceDefinition } from '@/data/places'

import { MAP_PROJECTION } from '@/map/config'

import type { ResolvedLine } from './lines'

import { closestPosition, distanceMeters } from './geometry'

/** A place further than this from every line is a mistake in the place list. */
const MAX_PLACE_DISTANCE_METERS = 150

/** A line serves a place if it passes within this distance of the place's point on the network. */
const SAME_POINT_METERS = 1

export interface ResolvedPlace {
	readonly definition: PlaceDefinition
	/** Point on the network in the map projection. */
	readonly coordinate: Coordinate
	/** Lines passing through the place, in the order of the line list. */
	readonly lineIds: readonly LineId[]
}

/** Moves a place onto the nearest line and finds every line that passes through it. */
export function resolvePlace (lines: readonly ResolvedLine[], definition: PlaceDefinition): ResolvedPlace {
	const point = fromLonLat(definition.coordinate, MAP_PROJECTION)
	const candidates = lines.map(line => ({ line, position: closestPosition(line.coordinates, point) }))
	const [best] = [...candidates].sort((a, b) => a.position.distanceMeters - b.position.distanceMeters)
	if (!best || best.position.distanceMeters > MAX_PLACE_DISTANCE_METERS) {
		throw new Error(`The place "${definition.name}" is not on any line.`)
	}
	const lineIds = candidates
		.filter(({ position }) => distanceMeters(position.coordinate, best.position.coordinate) < SAME_POINT_METERS)
		.map(({ line }) => line.definition.id)
	return { definition, coordinate: best.position.coordinate, lineIds }
}
