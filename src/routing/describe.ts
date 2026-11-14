import type { LineDefinition } from '@/data/lines'
import type { ResolvedLine } from '@/network/lines'
import type { ResolvedPlace } from '@/network/places'

import { itemAt } from '@/network/graph'
import { formatDistance, fullName, routePointAt, type RoutePoint } from '@/network/routePoints'

import type { Route } from './route'

export interface LegDescription {
	readonly line: LineDefinition
	/** Where the leg starts, with its preposition: "von Wik" or "vom Startpunkt". */
	readonly from: string
	/** Where the leg ends, with its preposition: "bis Karlstal" or "bis zum Zielpunkt". */
	readonly to: string
	readonly distance: string
}

export interface RouteDescription {
	/** For example "6,4 km, 1 Umstieg". */
	readonly summary: string
	/** One sentence for screen readers, for example "Linie 2 von Wik bis Karlstal, dann Linie 3 bis Mettenhof." */
	readonly sentence: string
	readonly legs: readonly LegDescription[]
	/** Names of the start, each change and the destination; a point chosen on the map is "Startpunkt" or "Zielpunkt". */
	readonly stops: readonly string[]
	/** Number of changes. */
	readonly changes: number
}

function describeChanges (changes: number): string {
	if (changes === 0) {
		return 'ohne Umstieg'
	}
	return changes === 1 ? '1 Umstieg' : `${String(changes)} Umstiege`
}

/**
 * Names the legs of a route: places by their names, the changes by the place where they happen. A point
 * chosen on the map is "Startpunkt" or "Zielpunkt" here; where it lies stands in the form and above its
 * marker, and would make the sentences hard to follow.
 */
export function describeRoute (route: Route, start: RoutePoint, destination: RoutePoint, lines: readonly ResolvedLine[], places: readonly ResolvedPlace[]): RouteDescription {
	const changeNames = route.legs.slice(0, -1).map(leg => {
		const end = itemAt(leg.coordinates, leg.coordinates.length - 1)
		const point = routePointAt(lines, places, end)
		return point ? fullName(point) : 'unbenannter Punkt'
	})
	const froms = [start.kind === 'point' ? 'vom Startpunkt' : `von ${start.name}`, ...changeNames.map(name => `von ${name}`)]
	const tos = [...changeNames.map(name => `bis ${name}`), destination.kind === 'point' ? 'bis zum Zielpunkt' : `bis ${destination.name}`]
	const legs = route.legs.map((leg, index) => {
		const line = lines.find(candidate => candidate.definition.id === leg.lineId)
		if (!line) {
			throw new Error(`Unbekannte Linie ${leg.lineId}.`)
		}
		return { line: line.definition, from: itemAt(froms, index), to: itemAt(tos, index), distance: formatDistance(leg.lengthMeters) }
	})
	const sentence = legs.map((leg, index) => index === 0 ? `${leg.line.name} ${leg.from} ${leg.to}` : `dann ${leg.line.name} ${leg.to}`).join(', ')
	const changes = route.legs.length - 1
	const stops = [start.kind === 'point' ? 'Startpunkt' : start.name, ...changeNames, destination.kind === 'point' ? 'Zielpunkt' : destination.name]
	return { summary: `${formatDistance(route.lengthMeters)}, ${describeChanges(changes)}`, sentence: `${sentence}.`, legs, stops, changes }
}
