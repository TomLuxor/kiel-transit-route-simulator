import { describe, expect, it } from 'vitest'

import { planarDistance } from '../geometry'
import { closestOnLines } from '../places'
import { describeLines, dragPoint, formatDistance, isSamePoint, LINE_PICK_PIXELS, lineBetween, lineEndPoints, pickPoint, placePoint } from '../routePoints'
import { at, farFromPlaces, lines, placeById, places } from './kielNetwork'

describe('names of points', () => {
	it.each([
		[['2'], 'Linie 2'],
		[['1', '3'], 'Linien 1 und 3'],
		[['1', '2', '4'], 'Linien 1, 2 und 4'],
		[['1', '2', '3', '4'], 'alle Linien'],
	] as const)('describes the lines %j as "%s"', (lineIds, text) => {
		expect(describeLines(lineIds)).toBe(text)
	})

	it('uses the dative after "auf": Punkt auf allen Linien', () => {
		expect(describeLines(['1', '2', '3', '4'], 'dative')).toBe('allen Linien')
	})

	it.each([
		[4, '0 m'],
		[337, '340 m'],
		[996, '1,0 km'],
		[1234, '1,2 km'],
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
		expect(point?.name).toBe('Punkt auf Linie 2')
		expect(point?.nearby).toMatch(/^[\d,]+ k?m von (Wik|Belvedere) entfernt$/)
	})

	it('reaches a line from up to 20 pixels away, at any zoom', () => {
		const click = at(10.10, 54.34)
		const position = closestOnLines(lines, click)
		const distance = position ? planarDistance(position.coordinate, click) : 0
		expect(distance).toBeGreaterThan(0)
		expect(pickPoint(lines, places, click, distance / (LINE_PICK_PIXELS - 1))).toBeDefined()
		expect(pickPoint(lines, places, click, distance / (LINE_PICK_PIXELS + 1))).toBeUndefined()
	})

	it('keeps a dragged point on the nearest line, however far the pointer strays', () => {
		const pointer = at(10.10, 54.34)
		const position = closestOnLines(lines, pointer)
		const distance = position ? planarDistance(position.coordinate, pointer) : 0
		// Far beyond the reach of a click.
		const resolution = distance / (LINE_PICK_PIXELS * 10)
		expect(pickPoint(lines, places, pointer, resolution)).toBeUndefined()
		expect(dragPoint(lines, places, pointer, resolution)?.coordinate).toEqual(position?.coordinate)
	})

	it('drops a dragged point onto a place when it passes over its dot', () => {
		const [x = 0, y = 0] = placeById('hauptbahnhof').coordinate
		expect(dragPoint(lines, places, [x + 10, y], 2)).toMatchObject({ kind: 'place', id: 'hauptbahnhof' })
		expect(dragPoint(lines, places, farFromPlaces(), 1)).toMatchObject({ kind: 'point' })
	})

	it('puts start and destination of a whole line at its ends, in the direction of its route', () => {
		const line2 = lines.find(line => line.definition.id === '2')
		const ends = line2 && lineEndPoints(line2, lines, places)
		expect(ends?.start).toMatchObject({ kind: 'place', id: 'elmschenhagen' })
		expect(ends?.destination).toMatchObject({ kind: 'place', id: 'wik' })
		// The route text of every line names its start first.
		for (const line of lines) {
			const { start } = lineEndPoints(line, lines, places) ?? {}
			if (start?.kind === 'place') {
				expect(line.definition.route.startsWith(start.name)).toBe(true)
			}
		}
	})

	it('knows which line runs from one point to the other, in either direction', () => {
		const wik = placeById('wik').coordinate
		const elmschenhagen = placeById('elmschenhagen').coordinate
		expect(lineBetween(lines, elmschenhagen, wik)).toBe('2')
		expect(lineBetween(lines, wik, elmschenhagen)).toBe('2')
		expect(lineBetween(lines, wik, placeById('hauptbahnhof').coordinate)).toBeUndefined()
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
