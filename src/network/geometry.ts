import type { Coordinate } from 'ol/coordinate'

import { toLonLat } from 'ol/proj'
import { getDistance } from 'ol/sphere'

import { MAP_PROJECTION } from '@/map/config'

/** Great-circle distance in meters between two coordinates in the map projection. */
export function distanceMeters (a: Coordinate, b: Coordinate): number {
	return getDistance(toLonLat(a, MAP_PROJECTION), toLonLat(b, MAP_PROJECTION))
}

/** Consecutive pairs of a list: [a, b, c] gives [a, b] and [b, c]. */
export function * pairs<T> (items: readonly T[]): Generator<[T, T, number]> {
	for (let index = 1; index < items.length; index++) {
		const previous = items[index - 1]
		const current = items[index]
		if (previous !== undefined && current !== undefined) {
			yield [previous, current, index - 1]
		}
	}
}

export function polylineLengthMeters (coordinates: readonly Coordinate[]): number {
	let length = 0
	for (const [a, b] of pairs(coordinates)) {
		length += distanceMeters(a, b)
	}
	return length
}

/** A position on a polyline: a segment and how far along it. */
export interface PolylinePosition {
	/** Index of the segment from coordinates[segment] to coordinates[segment + 1]. */
	readonly segment: number
	/** Position on that segment, 0 at its start and 1 at its end. */
	readonly fraction: number
	readonly coordinate: Coordinate
	/** Distance in meters between the query point and `coordinate`. */
	readonly distanceMeters: number
}

/** Distance in map units; in Web Mercator divided by the resolution, it gives the distance in screen pixels. */
export function planarDistance ([ax = 0, ay = 0]: Coordinate, [bx = 0, by = 0]: Coordinate): number {
	return Math.hypot(bx - ax, by - ay)
}

/**
 * The point on a polyline closest to `point`. Web Mercator is conformal, so comparing planar distances finds
 * the same point as comparing distances on the ground; only the result is measured in meters. This runs on
 * every pointer move over the map.
 */
export function closestPosition (coordinates: readonly Coordinate[], point: Coordinate): PolylinePosition {
	const [px = 0, py = 0] = point
	let best: Omit<PolylinePosition, 'distanceMeters'> | undefined
	let bestSquaredDistance = Infinity
	for (const [[ax = 0, ay = 0], [bx = 0, by = 0], segment] of pairs(coordinates)) {
		const dx = bx - ax
		const dy = by - ay
		const squaredLength = dx * dx + dy * dy
		const fraction = squaredLength === 0 ? 0 : Math.min(1, Math.max(0, ((px - ax) * dx + (py - ay) * dy) / squaredLength))
		const x = ax + fraction * dx
		const y = ay + fraction * dy
		const squaredDistance = (px - x) ** 2 + (py - y) ** 2
		if (squaredDistance < bestSquaredDistance) {
			best = { segment, fraction, coordinate: [x, y] }
			bestSquaredDistance = squaredDistance
		}
	}
	if (!best) {
		throw new Error('A polyline needs at least two coordinates.')
	}
	return { ...best, distanceMeters: distanceMeters(point, best.coordinate) }
}

/** Splits a polyline at the given positions; each position becomes the last point of one piece and the first of the next. */
export function splitPolyline (coordinates: readonly Coordinate[], positions: readonly PolylinePosition[]): Coordinate[][] {
	const sorted = [...positions].sort((a, b) => a.segment - b.segment || a.fraction - b.fraction)
	const pieces: Coordinate[][] = []
	let current: Coordinate[] = []
	let next = 0
	for (const [index, coordinate] of coordinates.entries()) {
		current.push(coordinate)
		let position = sorted[next]
		while (position?.segment === index) {
			current.push(position.coordinate)
			pieces.push(current)
			current = [position.coordinate]
			next++
			position = sorted[next]
		}
	}
	pieces.push(current)
	// Splitting exactly at a vertex leaves duplicate points; drop them, and drop pieces without length.
	return pieces
		.map(piece => piece.filter((coordinate, index) => index === 0 || !equalCoordinates(coordinate, piece[index - 1])))
		.filter(piece => piece.length >= 2)
}

function equalCoordinates (a: Coordinate, b: Coordinate | undefined): boolean {
	return b !== undefined && a[0] === b[0] && a[1] === b[1]
}
