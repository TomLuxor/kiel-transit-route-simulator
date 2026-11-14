import type { Coordinate } from 'ol/coordinate'

import { describe, expect, it } from 'vitest'

import { planarDistance } from '../geometry'
import { itemAt } from '../graph'
import { closestOnLines } from '../places'
import { describeLines, formatDistance, isSamePoint, LINE_PICK_PIXELS, pickPoint, placePoint } from '../routePoints'
import { at, lines, places } from './kielNetwork'

const placeById = (id: string) => {
	const place = places.find(candidate => candidate.definition.id === id)
	if (!place) {
		throw new Error(`No place ${id}.`)
	}
	return place
}

/** The coordinate of line 2 farthest from every named place, so a click there cannot hit a place. */
function farFromPlaces (): Coordinate {
	const line = itemAt(lines, 1)
	let best = itemAt(line.coordinates, 0)
	let bestDistance = 0
	for (const coordinate of line.coordinates) {
		const distance = Math.min(...places.map(place => planarDistance(place.coordinate, coordinate)))
		if (distance > bestDistance) {
			best = coordinate
			bestDistance = distance
		}
	}
	return best
}

describe('names of points', () => {
	it.each([
		[['2'], 'line 2'],
		[['1', '3'], 'lines 1 and 3'],
		[['1', '2', '4'], 'lines 1, 2 and 4'],
		[['1', '2', '3', '4'], 'all lines'],
	] as const)('describes the lines %j as "%s"', (lineIds, text) => {
		expect(describeLines(lineIds)).toBe(text)
	})

	it.each([
		[4, '0 m'],
		[337, '340 m'],
		[996, '1.0 km'],
		[1234, '1.2 km'],
	])('writes %d meters as "%s"', (meters, text) => {
		expect(formatDistance(meters)).toBe(text)
	})
})

describe('choosing a point with a click', () => {
	it('chooses the place when the click hits its dot', () => {
		const hauptbahnhof = placeById('hauptbahnhof')
		const [x = 0, y = 0] = hauptbahnhof.coordinate
		// 5 pixels next to the place at 2 m per pixel.
		expect(pickPoint(lines, places, [x + 10, y], 2)).toMatchObject({ kind: 'place', id: 'hauptbahnhof' })
	})

	it('chooses a point on the line between places and names it after the nearest place on that line', () => {
		const point = pickPoint(lines, places, farFromPlaces(), 1)
		expect(point).toMatchObject({ kind: 'point', lineIds: ['2'] })
		// The point farthest from all places lies between Wik and Belvedere.
		expect(point?.name).toMatch(/^Point on line 2, [\d.]+ k?m from (Wik|Belvedere)$/)
	})

	it('reaches a line from up to 20 pixels away, at any zoom', () => {
		const click = at(10.10, 54.34)
		const position = closestOnLines(lines, click)
		const distance = position ? planarDistance(position.coordinate, click) : 0
		expect(distance).toBeGreaterThan(0)
		expect(pickPoint(lines, places, click, distance / (LINE_PICK_PIXELS - 1))).toBeDefined()
		expect(pickPoint(lines, places, click, distance / (LINE_PICK_PIXELS + 1))).toBeUndefined()
	})

	it('treats a start and destination as the same if they are less than 50 m apart', () => {
		const hauptbahnhof = placePoint(placeById('hauptbahnhof'))
		const [x = 0, y = 0] = hauptbahnhof.coordinate
		const near = { ...hauptbahnhof, kind: 'point', id: 'near' } as const
		expect(isSamePoint(hauptbahnhof, hauptbahnhof)).toBe(true)
		// 30 map units are about 18 m on the ground at Kiel.
		expect(isSamePoint(hauptbahnhof, { ...near, coordinate: [x + 30, y] })).toBe(true)
		expect(isSamePoint(hauptbahnhof, placePoint(placeById('karlstal')))).toBe(false)
	})
})
