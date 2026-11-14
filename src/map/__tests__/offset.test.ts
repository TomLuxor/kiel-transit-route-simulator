import { describe, expect, it } from 'vitest'

import { offsetPolyline } from '../offset'

describe('offsetPolyline', () => {
	it('moves a straight line to its left for positive offsets and to its right for negative ones', () => {
		expect(offsetPolyline([[0, 0], [10, 0]], 2)).toEqual([[0, 2], [10, 2]])
		expect(offsetPolyline([[0, 0], [10, 0]], -2)).toEqual([[0, -2], [10, -2]])
	})

	it('keeps both legs parallel at a right-angle bend by moving the corner along the bisector', () => {
		// East, then north: the left side is the inside of the bend.
		const [start, corner, end] = offsetPolyline([[0, 0], [10, 0], [10, 10]], 1)
		expect(start).toEqual([0, 1])
		expect(corner?.[0]).toBeCloseTo(9)
		expect(corner?.[1]).toBeCloseTo(1)
		expect(end).toEqual([9, 10])
	})

	it('limits the corner of very sharp bends', () => {
		const [, corner = []] = offsetPolyline([[0, 0], [10, 0], [0, 0.1]], 1)
		expect(Math.hypot((corner[0] ?? 0) - 10, corner[1] ?? 0)).toBeLessThanOrEqual(2 + 1e-9)
	})

	it('ignores repeated points and returns a copy for a zero offset', () => {
		const line = [[0, 0], [0, 0], [10, 0]]
		expect(offsetPolyline(line, 1)).toEqual([[0, 1], [10, 1]])
		expect(offsetPolyline(line, 0)).toEqual([[0, 0], [10, 0]])
	})
})
