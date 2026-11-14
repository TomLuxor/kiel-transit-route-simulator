import type { Coordinate } from 'ol/coordinate'

import { type LineId, LINES } from '@/data/lines'

import type { ResolvedLine } from './lines'

import { distanceMeters, planarDistance } from './geometry'
import { closestOnLines, type LinePosition, type ResolvedPlace } from './places'

/** A click this close to a line, in screen pixels, chooses a point on it; about half a fingertip. */
export const LINE_PICK_PIXELS = 20

/** A click this close to a place, in screen pixels, chooses the place instead of a point next to it. */
export const PLACE_PICK_PIXELS = 12

/** Start and destination closer than this count as the same point; a ride needs some distance. */
export const MIN_ROUTE_METERS = 50

/** A start or destination: a named place, or a point chosen on a line on the map. */
export interface RoutePoint {
	readonly kind: 'place' | 'point'
	/** The place ID, or an ID made from the coordinate for a point. */
	readonly id: string
	/** Name in the form and for screen readers, for example "Point on line 2, 340 m from Belvedere". */
	readonly name: string
	/** Point on the network in the map projection. */
	readonly coordinate: Coordinate
	/** Lines passing through the point, in the order of the line list. */
	readonly lineIds: readonly LineId[]
}

/** "line 2", "lines 1, 2 and 4" or "all lines". */
export function describeLines (lineIds: readonly LineId[]): string {
	const last = lineIds[lineIds.length - 1] ?? ''
	if (lineIds.length <= 1) {
		return `line ${last}`
	}
	if (lineIds.length === LINES.length) {
		return 'all lines'
	}
	return `lines ${lineIds.slice(0, -1).join(', ')} and ${last}`
}

/** "340 m" below one kilometer, otherwise "1.2 km". */
export function formatDistance (meters: number): string {
	const rounded = Math.round(meters / 10) * 10
	return rounded < 1000 ? `${String(rounded)} m` : `${(meters / 1000).toFixed(1)} km`
}

export function placePoint (place: ResolvedPlace): RoutePoint {
	return { kind: 'place', id: place.definition.id, name: place.definition.name, coordinate: place.coordinate, lineIds: place.lineIds }
}

/** True if a ride from `a` to `b` would go nowhere. */
export function isSamePoint (a: RoutePoint, b: RoutePoint): boolean {
	return a.id === b.id || distanceMeters(a.coordinate, b.coordinate) < MIN_ROUTE_METERS
}

function nearestPlace (places: readonly ResolvedPlace[], coordinate: Coordinate, distance: (a: Coordinate, b: Coordinate) => number):
	{ place: ResolvedPlace, distance: number } | undefined {
	let best: { place: ResolvedPlace, distance: number } | undefined
	for (const place of places) {
		const candidate = distance(place.coordinate, coordinate)
		if (!best || candidate < best.distance) {
			best = { place, distance: candidate }
		}
	}
	return best
}

/** A point on a line, named after the nearest place on one of its lines, so that the name says where it is. */
function linePoint (position: LinePosition, places: readonly ResolvedPlace[]): RoutePoint {
	const onSameLine = places.filter(place => place.lineIds.some(lineId => position.lineIds.includes(lineId)))
	const nearest = nearestPlace(onSameLine.length > 0 ? onSameLine : places, position.coordinate, distanceMeters)
	const [x = 0, y = 0] = position.coordinate
	const where = nearest ? `, ${formatDistance(nearest.distance)} from ${nearest.place.definition.name}` : ''
	return {
		kind: 'point',
		id: `point-${x.toFixed(0)}-${y.toFixed(0)}`,
		name: `Point on ${describeLines(position.lineIds)}${where}`,
		coordinate: position.coordinate,
		lineIds: position.lineIds,
	}
}

/**
 * What a click at `coordinate` chooses at the given map resolution: the place next to the click, else the
 * nearest point on a line, or undefined if the click is too far from every line.
 */
export function pickPoint (lines: readonly ResolvedLine[], places: readonly ResolvedPlace[], coordinate: Coordinate, resolution: number): RoutePoint | undefined {
	const position = closestOnLines(lines, coordinate)
	if (!position || planarDistance(position.coordinate, coordinate) / resolution > LINE_PICK_PIXELS) {
		return undefined
	}
	const place = nearestPlace(places, coordinate, planarDistance)
	if (place && place.distance / resolution <= PLACE_PICK_PIXELS) {
		return placePoint(place.place)
	}
	return linePoint(position, places)
}
