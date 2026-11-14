import { describe, expect, it } from 'vitest'

import { lines, network, placeById } from '@/network/__tests__/kielNetwork'
import { closestPosition, distanceMeters, polylineLengthMeters } from '@/network/geometry'
import { itemAt } from '@/network/graph'

import { advanceRide, CHANGE_STOP_MS, DEPARTURE_MS, type RideOptions, ridePosition, type RideState, startRide, travelledMeters } from '../ride'
import { findRoute, type Route } from '../route'

function wikToMettenhof (): Route {
	const route = findRoute(network, lines, placeById('wik').coordinate, placeById('mettenhof').coordinate)
	if (route?.legs.length !== 2) {
		throw new Error('Expected two legs from Wik to Mettenhof.')
	}
	return route
}

const route = wikToMettenhof()
const FRAME_MS = 16
const continuous: RideOptions = { metersPerSecond: 300, stepped: false, stepMs: 3000 }
const stepped: RideOptions = { ...continuous, stepped: true }

/** All states of a ride in steps of one frame, up to the arrival. */
function rideThrough (options: RideOptions): RideState[] {
	let state = startRide(options)
	const states = [state]
	while (!state.arrived && states.length < 100_000) {
		state = advanceRide(route, state, FRAME_MS, options)
		states.push(state)
	}
	return states
}

const lastOf = <T>(items: readonly T[]): T => itemAt(items, items.length - 1)

describe('the ride', () => {
	it('waits at the start while the map zooms there, then moves at the chosen speed', () => {
		let state = advanceRide(route, startRide(continuous), DEPARTURE_MS, continuous)
		expect(state.metersOnLeg).toBe(0)
		state = advanceRide(route, state, 1000, continuous)
		expect(state.metersOnLeg).toBeCloseTo(300)
		state = advanceRide(route, state, 1000, { ...continuous, metersPerSecond: 600 })
		expect(state.metersOnLeg).toBeCloseTo(900)
	})

	it('arrives at the destination after the time that the distance and the stops take', () => {
		const states = rideThrough(continuous)
		const arrival = lastOf(states)
		expect(arrival.arrived).toBe(true)
		const seconds = (states.length - 1) * FRAME_MS / 1000
		expect(seconds).toBeCloseTo((DEPARTURE_MS + CHANGE_STOP_MS) / 1000 + route.lengthMeters / continuous.metersPerSecond, 0)
		expect(distanceMeters(ridePosition(route, arrival).coordinate, placeById('mettenhof').coordinate)).toBeLessThan(0.01)
	})

	it('stops at the change of line, where the first leg ends', () => {
		const change = rideThrough(continuous).find(state => state.legIndex === 1)
		expect(change).toMatchObject({ metersOnLeg: 0, waitMs: CHANGE_STOP_MS })
		if (change) {
			const firstLeg = itemAt(route.legs, 0)
			expect(ridePosition(route, change).coordinate).toEqual(lastOf(firstLeg.coordinates))
		}
	})

	it('stays on the route and never goes backwards', () => {
		const states = rideThrough(continuous)
		for (const [index, state] of states.entries()) {
			if (index > 0) {
				expect(travelledMeters(route, state)).toBeGreaterThanOrEqual(travelledMeters(route, itemAt(states, index - 1)))
			}
			if (index % 50 === 0) {
				const { coordinate } = ridePosition(route, state)
				expect(closestPosition(itemAt(route.legs, state.legIndex).coordinates, coordinate).distanceMeters).toBeLessThan(0.5)
			}
		}
	})

	it('draws the way travelled as long as the distance travelled', () => {
		const states = rideThrough(continuous)
		const state = itemAt(states, Math.floor(states.length * 0.7))
		const drawn = ridePosition(route, state).travelled.reduce((sum, part) => sum + polylineLengthMeters(part), 0)
		expect(drawn).toBeCloseTo(travelledMeters(route, state), 0)
	})

	it('with reduced motion, jumps from leg to leg instead of moving', () => {
		const states = rideThrough(stepped)
		expect(lastOf(states).arrived).toBe(true)
		for (const state of states) {
			expect([0, itemAt(route.legs, state.legIndex).lengthMeters]).toContain(state.metersOnLeg)
		}
	})
})
