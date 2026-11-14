import type { Coordinate } from 'ol/coordinate'

import { describe, expect, it } from 'vitest'

import { PLACES } from '@/data/places'

import { closestPosition, distanceMeters, pairs, splitPolyline } from '../geometry'
import { buildNetwork, DEFAULT_TOLERANCE_METERS, findShortestPath, itemAt, nearestNode, type NetworkPart } from '../graph'
import { resolvePlace } from '../places'
import { sectionParts } from '../sections'
import { at, lines, network, sections } from './kielNetwork'

const part = (sectionId: number, ...lonLats: [number, number][]): NetworkPart => ({
	sectionId,
	coordinates: lonLats.map(([lon, lat]) => at(lon, lat)),
})

describe('geometry', () => {
	it('finds the closest point on a polyline', () => {
		const position = closestPosition([at(10.10, 54.30), at(10.12, 54.30)], at(10.11, 54.301))
		expect(position.segment).toBe(0)
		expect(position.fraction).toBeCloseTo(0.5, 3)
		expect(position.distanceMeters).toBeCloseTo(111, 0)
	})

	it('splits a polyline at a position and shares the split point between the pieces', () => {
		const line = [at(10.10, 54.30), at(10.12, 54.30), at(10.14, 54.30)]
		const position = closestPosition(line, at(10.11, 54.30))
		const pieces = splitPolyline(line, [position])
		expect(pieces).toHaveLength(2)
		const [first = [], second = []] = pieces
		expect(first[first.length - 1]).toEqual(second[0])
	})
})

describe('network graph', () => {
	it('splits a line where another line branches off in its middle', () => {
		const network = buildNetwork([
			part(1, [10.10, 54.30], [10.12, 54.30]),
			// Ends about 22 m north of the middle of part 1.
			part(2, [10.11, 54.3002], [10.11, 54.31]),
		])
		expect(network.edges).toHaveLength(3)
		expect(network.nodes).toHaveLength(4)
		const from = nearestNode(network, at(10.10, 54.30)).node.id
		const to = nearestNode(network, at(10.11, 54.31)).node.id
		expect(findShortestPath(network, from, to)?.edgeIds).toHaveLength(2)
	})

	it('closes gaps below the tolerance and keeps larger gaps open', () => {
		// About 39 m apart.
		const closed = buildNetwork([part(1, [10.10, 54.30], [10.11, 54.30]), part(2, [10.1106, 54.30], [10.12, 54.30])])
		// About 78 m apart.
		const open = buildNetwork([part(1, [10.10, 54.30], [10.11, 54.30]), part(2, [10.1112, 54.30], [10.12, 54.30])])

		const ends = (network: typeof closed): [number, number] => [
			nearestNode(network, at(10.10, 54.30)).node.id,
			nearestNode(network, at(10.12, 54.30)).node.id,
		]
		expect(findShortestPath(closed, ...ends(closed))).toBeDefined()
		expect(findShortestPath(open, ...ends(open))).toBeUndefined()
	})
})

describe('the Kiel Stadtbahn network (WFS snapshot of 14 November 2026)', () => {
	it('reads all 16 route sections', () => {
		expect(sections).toHaveLength(16)
	})

	it.each(lines)('lays $definition.name onto the network at its official length (±5 %)', line => {
		const kilometers = line.path.lengthMeters / 1000
		expect(Math.abs(kilometers - line.definition.officialLengthKm) / line.definition.officialLengthKm).toBeLessThan(0.05)
	})

	it('uses as much track as the official operated network (34.7 km, ±3 %), each shared stretch counted once', () => {
		const edgeIds = new Set(lines.flatMap(line => line.path.edgeIds))
		const kilometers = [...edgeIds].reduce((sum, edgeId) => sum + itemAt(network.edges, edgeId).lengthMeters, 0) / 1000
		expect(Math.abs(kilometers - 34.7) / 34.7).toBeLessThan(0.03)
	})

	it('connects every line end to every other', () => {
		const ends = lines.flatMap(line => [itemAt(line.path.nodeIds, 0), itemAt(line.path.nodeIds, line.path.nodeIds.length - 1)])
		for (const end of ends) {
			expect(findShortestPath(network, itemAt(ends, 0), end)).toBeDefined()
		}
	})

	it('runs all four lines over the shared trunk from Andreas-Gayk-Straße via Hauptbahnhof to Karlstal', () => {
		const [first, ...others] = lines.map(line => new Set(line.path.edgeIds))
		const shared = [...first ?? []].filter(edgeId => others.every(edges => edges.has(edgeId)))
		const sharedMeters = shared.reduce((sum, edgeId) => sum + itemAt(network.edges, edgeId).lengthMeters, 0)
		// Andreas-Gayk-Straße to Hauptbahnhof is about 0.9 km, Hauptbahnhof to Karlstal about 1.1 km.
		expect(sharedMeters).toBeGreaterThan(1900)
		expect(sharedMeters).toBeLessThan(2400)
	})

	it('keeps the depot tracks (Abschnitt 2, features 25 and 26) out of every line', () => {
		for (const line of lines) {
			const sectionIds = line.path.edgeIds.map(edgeId => itemAt(network.edges, edgeId).sectionId)
			expect(sectionIds).not.toContain(25)
			expect(sectionIds).not.toContain(26)
		}
	})

	it.each([
		['wik', ['2']],
		['suchsdorf', ['1']],
		['projensdorf', ['4']],
		['torfende', ['1', '4']],
		['belvedere', ['2']],
		['cau', ['1', '4']],
		['ansgarkirche', ['1', '2', '4']],
		['dreiecksplatz', ['1', '2', '4']],
		['kurt-schumacher-platz', ['3']],
		['andreas-gayk-strasse', ['1', '2', '3', '4']],
		['hauptbahnhof', ['1', '2', '3', '4']],
		['karlstal', ['1', '2', '3', '4']],
		['alfons-jonas-platz', ['1', '3']],
		['am-langsee', ['2', '4']],
		['wellingdorf', ['1', '3']],
		['tiefe-allee', ['1', '3']],
		['haw-kiel', ['1']],
		['dietrichsdorf', ['3']],
		['elmschenhagen', ['2']],
	])('places %s on the lines %j', (id, lineIds) => {
		const place = PLACES.find(candidate => candidate.id === id)
		expect(place).toBeDefined()
		if (place) {
			expect(resolvePlace(lines, place).lineIds).toEqual(lineIds)
		}
	})

	it('places every named place on at least one line', () => {
		for (const place of PLACES) {
			expect(resolvePlace(lines, place).lineIds.length).toBeGreaterThan(0)
		}
	})

	it('takes no shortcuts: every step longer than the tolerance stays on the WFS track', () => {
		const parts = sectionParts(sections)
		const distanceToSource = (point: Coordinate): number => Math.min(...parts.map(({ coordinates }) => closestPosition(coordinates, point).distanceMeters))
		for (const line of lines) {
			for (const [[ax = 0, ay = 0], [bx = 0, by = 0]] of pairs(line.coordinates)) {
				if (distanceMeters([ax, ay], [bx, by]) > DEFAULT_TOLERANCE_METERS) {
					// 5 m allows the straight chord across the junction curves at the depot branch (1.9 m off);
					// a real shortcut would leave the track by tens of meters.
					expect(distanceToSource([(ax + bx) / 2, (ay + by) / 2])).toBeLessThan(5)
				}
			}
		}
	})
})
