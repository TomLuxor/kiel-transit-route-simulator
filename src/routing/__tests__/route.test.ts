import type { Coordinate } from 'ol/coordinate'

import { describe, expect, it } from 'vitest'

import type { LineDefinition, LineId } from '@/data/lines'

import { at, farFromPlaces, lines, network, placeById, places } from '@/network/__tests__/kielNetwork'
import { distanceMeters } from '@/network/geometry'
import { buildNetwork, itemAt } from '@/network/graph'
import { resolveLine } from '@/network/lines'
import { pickPoint, placePoint } from '@/network/routePoints'

import { describeRoute } from '../describe'
import { findRoute, type Route } from '../route'

const routeBetween = (from: string, to: string): Route | undefined =>
	findRoute(network, lines, placeById(from).coordinate, placeById(to).coordinate)

const lineIdsOf = (route: Route | undefined): LineId[] => route?.legs.map(leg => leg.lineId) ?? []

const first = (coordinates: readonly Coordinate[]): Coordinate => itemAt(coordinates, 0)
const last = (coordinates: readonly Coordinate[]): Coordinate => itemAt(coordinates, coordinates.length - 1)

describe('routes on the Kiel network', () => {
	it('relies on a track without loops: the track the lines use is a tree', () => {
		const edgeIds = new Set(lines.flatMap(line => line.path.edgeIds))
		const nodeIds = new Set([...edgeIds].flatMap(edgeId => [itemAt(network.edges, edgeId).from, itemAt(network.edges, edgeId).to]))
		// Connected (every line meets the trunk) and one node more than edges: a tree.
		expect(nodeIds.size).toBe(edgeIds.size + 1)
	})

	it('rides one line when start and destination are on it', () => {
		expect(lineIdsOf(routeBetween('wik', 'belvedere'))).toEqual(['2'])
	})

	it('changes once, where the second line joins: Wik to Mettenhof', () => {
		const route = routeBetween('wik', 'mettenhof')
		expect(lineIdsOf(route)).toEqual(['2', '3'])
		const change = last(route?.legs[0]?.coordinates ?? [])
		expect(distanceMeters(change, placeById('andreas-gayk-strasse').coordinate)).toBeLessThan(30)
	})

	it('stays on the first line until it turns off: Suchsdorf to Elmschenhagen changes at Karlstal', () => {
		const route = routeBetween('suchsdorf', 'elmschenhagen')
		expect(lineIdsOf(route)).toEqual(['1', '2'])
		const change = last(route?.legs[0]?.coordinates ?? [])
		expect(distanceMeters(change, placeById('karlstal').coordinate)).toBeLessThan(30)
	})

	it('starts on a junction served by all lines and takes the one line that goes all the way', () => {
		expect(lineIdsOf(routeBetween('hauptbahnhof', 'dietrichsdorf'))).toEqual(['3'])
	})

	it('starts between two places, in the middle of a track', () => {
		const route = findRoute(network, lines, farFromPlaces(), placeById('wik').coordinate)
		expect(lineIdsOf(route)).toEqual(['2'])
		expect(route?.lengthMeters).toBeGreaterThan(500)
	})

	it('connects every pair of places with at most one change, because all lines share the trunk', () => {
		for (const from of places) {
			for (const to of places) {
				if (from !== to) {
					const route = findRoute(network, lines, from.coordinate, to.coordinate)
					expect(route?.legs.length, `${from.definition.id} to ${to.definition.id}`).toBeGreaterThanOrEqual(1)
					expect(route?.legs.length, `${from.definition.id} to ${to.definition.id}`).toBeLessThanOrEqual(2)
				}
			}
		}
	})

	it('runs without gaps from the start to the destination, the same length in both directions', () => {
		const route = routeBetween('kurt-schumacher-platz', 'projensdorf')
		const legs = route?.legs ?? []
		expect(distanceMeters(first(itemAt(legs, 0).coordinates), placeById('kurt-schumacher-platz').coordinate)).toBeLessThan(0.01)
		expect(distanceMeters(last(itemAt(legs, legs.length - 1).coordinates), placeById('projensdorf').coordinate)).toBeLessThan(0.01)
		for (let index = 1; index < legs.length; index++) {
			expect(first(itemAt(legs, index).coordinates)).toEqual(last(itemAt(legs, index - 1).coordinates))
		}
		expect(routeBetween('projensdorf', 'kurt-schumacher-platz')?.lengthMeters).toBeCloseTo(route?.lengthMeters ?? 0, 3)
	})

	it('describes the route in German, naming the place of the change', () => {
		const route = routeBetween('wik', 'mettenhof')
		expect(route).toBeDefined()
		if (route) {
			const description = describeRoute(route, placePoint(placeById('wik')), placePoint(placeById('mettenhof')), lines, places)
			expect(description.sentence).toBe('Linie 2 von Wik bis Andreas-Gayk-Straße / Ziegelteich, dann Linie 3 bis Mettenhof.')
			expect(description.summary).toMatch(/^\d+,\d km, 1 Umstieg$/)
			expect(description.changes).toBe(1)
		}
	})

	it('calls a point chosen on the map "Startpunkt" in the description, because the form already shows where it is', () => {
		const start = pickPoint(lines, places, farFromPlaces(), 1)
		const route = start && findRoute(network, lines, start.coordinate, placeById('wik').coordinate)
		expect(start?.kind).toBe('point')
		if (start && route) {
			const description = describeRoute(route, start, placePoint(placeById('wik')), lines, places)
			expect(description.sentence).toBe('Linie 2 vom Startpunkt bis Wik.')
			expect(description.summary).toMatch(/^\d+,\d km, ohne Umstieg$/)
		}
	})
})

describe('routes on a small test network', () => {
	// Four stations in a row, about 1.3 km apart.
	const stations: [number, number][] = [[10.10, 54.30], [10.12, 54.30], [10.14, 54.30], [10.16, 54.30]]
	const [a, b, c, d] = stations.map(([lon, lat]) => at(lon, lat))
	const testNetwork = buildNetwork([0, 1, 2].map(index => ({
		sectionId: index,
		coordinates: [itemAt(stations, index), itemAt(stations, index + 1)].map(([lon, lat]) => at(lon, lat)),
	})))
	const line = (id: LineId, from: number, to: number): LineDefinition => ({
		id,
		name: `Linie ${id}`,
		route: '',
		officialLengthKm: 0,
		waypoints: [itemAt(stations, from), itemAt(stations, to)],
		color: '#000000',
		onColor: '#ffffff',
	})
	const shortLines = [line('1', 0, 1), line('2', 1, 2), line('3', 2, 3)].map(definition => resolveLine(testNetwork, definition))

	it('changes twice when three lines follow each other', () => {
		const route = findRoute(testNetwork, shortLines, a ?? [], d ?? [])
		expect(lineIdsOf(route)).toEqual(['1', '2', '3'])
	})

	it('prefers one change over two when a longer line exists', () => {
		const withLongLine = [...shortLines, resolveLine(testNetwork, line('4', 1, 3))]
		expect(lineIdsOf(findRoute(testNetwork, withLongLine, a ?? [], d ?? []))).toEqual(['1', '4'])
	})

	it('rides between two points on the same edge without leaving it', () => {
		const [ax = 0, ay = 0] = b ?? []
		const [cx = 0, cy = 0] = c ?? []
		const from = [ax + (cx - ax) * 0.25, ay]
		const to = [ax + (cx - ax) * 0.75, cy]
		const route = findRoute(testNetwork, shortLines, from, to)
		expect(lineIdsOf(route)).toEqual(['2'])
		expect(route?.lengthMeters).toBeCloseTo(distanceMeters(from, to), 0)
	})
})
