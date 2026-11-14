import type { Coordinate } from 'ol/coordinate'

import { pairs } from '@/network/geometry'

/** Limits the miter at sharp bends, so that an offset line never shoots out far beyond its corner. */
const MAX_MITER_SCALE = 2

/** Unit normal pointing to the left of the direction from `a` to `b` (map y points north). */
function leftNormal ([ax = 0, ay = 0]: Coordinate, [bx = 0, by = 0]: Coordinate): Coordinate {
	const length = Math.hypot(bx - ax, by - ay)
	return [-(by - ay) / length, (bx - ax) / length]
}

/** Direction to move a vertex between two segments: along the bisector, stretched so both offset segments stay parallel. */
function miter (before: Coordinate | undefined, after: Coordinate | undefined): Coordinate {
	if (!before || !after) {
		return before ?? after ?? [0, 0]
	}
	const [bx = 0, by = 0] = before
	const [ax = 0, ay = 0] = after
	const length = Math.hypot(bx + ax, by + ay)
	// A full U-turn has no bisector; keep the normal of the following segment.
	if (length < 1e-9) {
		return after
	}
	const [ux, uy] = [(bx + ax) / length, (by + ay) / length]
	const scale = Math.min(1 / (ux * ax + uy * ay), MAX_MITER_SCALE)
	return [ux * scale, uy * scale]
}

/**
 * Shifts a polyline sideways by `offset` map units, to the left of its direction for positive values.
 * Used to draw lines that share a track side by side.
 */
export function offsetPolyline (coordinates: readonly Coordinate[], offset: number): Coordinate[] {
	const points = coordinates.filter((point, index) => {
		const previous = coordinates[index - 1]
		return !previous || point[0] !== previous[0] || point[1] !== previous[1]
	})
	if (offset === 0 || points.length < 2) {
		return points.map(point => [...point])
	}
	const normals = [...pairs(points)].map(([a, b]) => leftNormal(a, b))
	return points.map(([x = 0, y = 0], index) => {
		const [nx = 0, ny = 0] = miter(normals[index - 1], normals[index])
		return [x + nx * offset, y + ny * offset]
	})
}
