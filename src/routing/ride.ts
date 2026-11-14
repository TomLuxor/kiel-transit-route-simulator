import type { Coordinate } from 'ol/coordinate'

import { distanceMeters, pairs } from '@/network/geometry'
import { itemAt } from '@/network/graph'

import type { Route, RouteLeg } from './route'

/** Stop at a change of line, in milliseconds. */
export const CHANGE_STOP_MS = 1500

/** Wait at the start before moving, in milliseconds: time for the map to zoom to the start. */
export const DEPARTURE_MS = 1500

export interface RideOptions {
	/** Simulated speed: meters along the route per second of animation. */
	readonly metersPerSecond: number
	/**
	 * Reduced motion: show every leg for `stepMs` at its start, then jump to its end, instead of moving
	 * continuously (WCAG 2.3.3).
	 */
	readonly stepped: boolean
	readonly stepMs: number
}

/** Where the ride is. The vehicle never sits at the end of a leg except at the destination: a change starts the next leg. */
export interface RideState {
	readonly legIndex: number
	readonly metersOnLeg: number
	/** Time left before moving on: departure, a change of line, or a step with reduced motion. */
	readonly waitMs: number
	readonly arrived: boolean
}

export interface RidePosition {
	readonly coordinate: Coordinate
	/** The way already travelled, one polyline per leg, in the map projection. */
	readonly travelled: readonly (readonly Coordinate[])[]
}

export function startRide (options: RideOptions): RideState {
	return { legIndex: 0, metersOnLeg: 0, waitMs: options.stepped ? options.stepMs : DEPARTURE_MS, arrived: false }
}

/** The state `elapsedMs` later. The speed can change between calls. */
export function advanceRide (route: Route, state: RideState, elapsedMs: number, options: RideOptions): RideState {
	if (state.arrived) {
		return state
	}
	if (state.waitMs > 0) {
		return { ...state, waitMs: Math.max(0, state.waitMs - elapsedMs) }
	}
	const leg = itemAt(route.legs, state.legIndex)
	const meters = options.stepped ? leg.lengthMeters : state.metersOnLeg + options.metersPerSecond * elapsedMs / 1000
	if (meters < leg.lengthMeters) {
		return { ...state, metersOnLeg: meters }
	}
	if (state.legIndex === route.legs.length - 1) {
		return { ...state, metersOnLeg: leg.lengthMeters, arrived: true }
	}
	return { legIndex: state.legIndex + 1, metersOnLeg: 0, waitMs: options.stepped ? options.stepMs : CHANGE_STOP_MS, arrived: false }
}

/** Distances from the start of each leg to each of its coordinates, computed once per leg. */
const measureCache = new WeakMap<RouteLeg, number[]>()
function measures (leg: RouteLeg): number[] {
	let cumulative = measureCache.get(leg)
	if (!cumulative) {
		cumulative = [0]
		for (const [a, b] of pairs(leg.coordinates)) {
			cumulative.push(itemAt(cumulative, cumulative.length - 1) + distanceMeters(a, b))
		}
		measureCache.set(leg, cumulative)
	}
	return cumulative
}

/** Index of the last coordinate at or before `meters` along the leg (binary search). */
function vertexBefore (cumulative: readonly number[], meters: number): number {
	let low = 0
	let high = cumulative.length - 1
	while (low < high) {
		const middle = Math.ceil((low + high) / 2)
		if (itemAt(cumulative, middle) <= meters) {
			low = middle
		} else {
			high = middle - 1
		}
	}
	return low
}

/** The position of the vehicle and the way travelled so far. */
export function ridePosition (route: Route, state: RideState): RidePosition {
	const leg = itemAt(route.legs, state.legIndex)
	const cumulative = measures(leg)
	const vertex = vertexBefore(cumulative, state.metersOnLeg)
	const previousLegs = route.legs.slice(0, state.legIndex).map(({ coordinates }) => coordinates)
	if (vertex >= leg.coordinates.length - 1) {
		return { coordinate: itemAt(leg.coordinates, leg.coordinates.length - 1), travelled: [...previousLegs, leg.coordinates] }
	}
	const [ax = 0, ay = 0] = itemAt(leg.coordinates, vertex)
	const [bx = 0, by = 0] = itemAt(leg.coordinates, vertex + 1)
	const segmentMeters = itemAt(cumulative, vertex + 1) - itemAt(cumulative, vertex)
	const fraction = segmentMeters > 0 ? (state.metersOnLeg - itemAt(cumulative, vertex)) / segmentMeters : 0
	const coordinate = [ax + fraction * (bx - ax), ay + fraction * (by - ay)]
	return { coordinate, travelled: [...previousLegs, [...leg.coordinates.slice(0, vertex + 1), coordinate]] }
}

/** Meters travelled since the start. */
export function travelledMeters (route: Route, state: RideState): number {
	return route.legs.slice(0, state.legIndex).reduce((sum, leg) => sum + leg.lengthMeters, 0) + state.metersOnLeg
}
