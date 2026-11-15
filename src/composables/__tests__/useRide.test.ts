import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, shallowRef } from 'vue'

import type { RouteDescription } from '@/routing/describe'

import { lines, network, placeById, places } from '@/network/__tests__/kielNetwork'
import { placePoint } from '@/network/routePoints'
import { describeRoute } from '@/routing/describe'
import { findRoute, type Route } from '@/routing/route'

import { useRide } from '../useRide'

/** A fake animation clock: frames run only when the test advances time. */
let callbacks: FrameRequestCallback[] = []
let now = 0
function runFor (milliseconds: number): void {
	const end = now + milliseconds
	while (now < end && callbacks.length > 0) {
		now += 16
		const due = callbacks
		callbacks = []
		for (const callback of due) {
			callback(now)
		}
	}
}

beforeEach(() => {
	callbacks = []
	now = 0
	vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => callbacks.push(callback))
	vi.stubGlobal('cancelAnimationFrame', () => {
		callbacks = []
	})
})

afterEach(() => {
	vi.unstubAllGlobals()
})

function setUp (from: string, to: string) {
	const start = placePoint(placeById(from))
	const destination = placePoint(placeById(to))
	const found = findRoute(network, lines, start.coordinate, destination.coordinate)
	if (!found) {
		throw new Error('No route.')
	}
	const route = shallowRef<Route | undefined>(found)
	const description = shallowRef<RouteDescription | undefined>(describeRoute(found, start, destination, lines, places))
	const scope = effectScope()
	const ride = scope.run(() => useRide(route, description, () => false))
	if (!ride) {
		throw new Error('No ride.')
	}
	return { ride, route, scope }
}

describe('riding a route', () => {
	it('announces the departure, the change and the arrival', () => {
		const { ride } = setUp('wik', 'mettenhof')
		ride.start()
		expect(ride.status.value).toBe('running')
		expect(ride.message.value).toBe('Abfahrt: Wik, mit Linie 2.')

		while (ride.view.value?.state.legIndex === 0) {
			runFor(100)
		}
		expect(ride.message.value).toBe('Andreas-Gayk-Straße / Ziegelteich: Umstieg in Linie 3.')

		runFor(120_000)
		expect(ride.status.value).toBe('arrived')
		expect(ride.message.value).toBe('Angekommen: Mettenhof.')
		expect(ride.progress.value).toBe(1)
	})

	it('stands still while paused and goes on when resumed', () => {
		const { ride } = setUp('wik', 'belvedere')
		ride.start()
		runFor(3000)
		ride.pause()
		const paused = ride.progress.value
		expect(paused).toBeGreaterThan(0)
		runFor(3000)
		expect(ride.progress.value).toBe(paused)
		expect(ride.message.value).toBe('Fahrt angehalten.')
		// The button shows a pause the user asked for, so it is only read out.
		expect(ride.messageShown.value).toBe(false)
		ride.resume()
		runFor(1000)
		expect(ride.progress.value).toBeGreaterThan(paused)
	})

	it('shows why it paused when the user did not ask for it', () => {
		const { ride } = setUp('wik', 'belvedere')
		ride.start()
		runFor(1000)
		ride.pause('die Karte verschoben wurde')
		expect(ride.message.value).toBe('Fahrt angehalten, weil die Karte verschoben wurde.')
		expect(ride.messageShown.value).toBe(true)
		ride.resume()
		expect(ride.messageShown.value).toBe(false)
	})

	it('ends when start or destination change', async () => {
		const { ride, route } = setUp('wik', 'belvedere')
		ride.start()
		runFor(2000)
		route.value = findRoute(network, lines, placeById('wik').coordinate, placeById('karlstal').coordinate)
		await nextTick()
		expect(ride.status.value).toBe('idle')
		expect(ride.view.value).toBeUndefined()
	})
})
