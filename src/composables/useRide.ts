import { computed, onScopeDispose, ref, type Ref, shallowRef, watch } from 'vue'

import type { LineId } from '@/data/lines'
import type { RouteDescription } from '@/routing/describe'
import type { Route } from '@/routing/route'

import { prefersReducedMotion } from '@/map/motion'
import { itemAt } from '@/network/graph'
import { advanceRide, type RideOptions, ridePosition, type RidePosition, type RideState, startRide, travelledMeters } from '@/routing/ride'

import { useAnnouncer } from './useAnnouncer'

export type RideStatus = 'idle' | 'running' | 'paused' | 'arrived'

export type RideSpeed = 'slow' | 'normal' | 'fast'

/**
 * Simulated speeds in meters per second of animation. A tram averages about 20 km/h (5.6 m/s) including
 * stops, so "normal" is about 50 times real time: the longest route takes about a minute.
 */
export const RIDE_SPEEDS: Readonly<Record<RideSpeed, { label: string, metersPerSecond: number }>> = {
	slow: { label: 'Langsam', metersPerSecond: 150 },
	normal: { label: 'Normal', metersPerSecond: 300 },
	fast: { label: 'Schnell', metersPerSecond: 600 },
}

/** With reduced motion, each leg is shown this long at normal speed before the jump to its end. */
const STEP_MS_AT_NORMAL_SPEED = 3000

/** Longest time step per frame, so that the vehicle does not jump after the tab was in the background. */
const MAX_FRAME_MS = 100

/** What the map needs to show a ride. */
export interface RideView {
	readonly status: Exclude<RideStatus, 'idle'>
	readonly state: RideState
	readonly position: RidePosition
	readonly lineId: LineId
	/** Reduced motion: the map jumps from leg to leg instead of following the vehicle. */
	readonly stepped: boolean
}

/**
 * The simulated ride along a route: start, pause, resume and stop, a speed that can change during the ride,
 * and announcements for a live region at departure, at every change and on arrival. A new route ends the ride.
 */
export function useRide (
	route: Readonly<Ref<Route | undefined>>,
	description: Readonly<Ref<RouteDescription | undefined>>,
	reducedMotion: () => boolean = prefersReducedMotion,
) {
	const status = ref<RideStatus>('idle')
	const speed = ref<RideSpeed>('normal')
	const state = shallowRef<RideState>()
	const stepped = ref(false)
	const { message, announce } = useAnnouncer()
	let frame: number | undefined
	let lastTime: number | undefined

	function options (): RideOptions {
		const { metersPerSecond } = RIDE_SPEEDS[speed.value]
		return { metersPerSecond, stepped: stepped.value, stepMs: STEP_MS_AT_NORMAL_SPEED * RIDE_SPEEDS.normal.metersPerSecond / metersPerSecond }
	}

	function cancelFrames (): void {
		if (frame !== undefined) {
			cancelAnimationFrame(frame)
		}
		frame = undefined
		lastTime = undefined
	}

	function stop (text?: string): void {
		cancelFrames()
		status.value = 'idle'
		state.value = undefined
		if (text) {
			announce(text)
		}
	}

	function tick (time: number): void {
		frame = undefined
		const currentRoute = route.value
		const current = state.value
		if (!currentRoute || !current || status.value !== 'running') {
			return
		}
		const elapsed = lastTime === undefined ? 0 : Math.min(time - lastTime, MAX_FRAME_MS)
		lastTime = time
		const next = advanceRide(currentRoute, current, elapsed, options())
		state.value = next
		const stops = description.value?.stops ?? []
		if (next.legIndex !== current.legIndex) {
			const line = description.value?.legs[next.legIndex]?.line.name ?? ''
			announce(`${stops[next.legIndex] ?? ''}: Umstieg in ${line}.`)
		}
		if (next.arrived) {
			status.value = 'arrived'
			announce(`Angekommen: ${stops[stops.length - 1] ?? ''}.`)
			return
		}
		frame = requestAnimationFrame(tick)
	}

	function start (): void {
		if (!route.value) {
			return
		}
		cancelFrames()
		stepped.value = reducedMotion()
		state.value = startRide(options())
		status.value = 'running'
		const line = description.value?.legs[0]?.line.name ?? ''
		announce(`Abfahrt: ${description.value?.stops[0] ?? ''}, mit ${line}.`)
		frame = requestAnimationFrame(tick)
	}

	function pause (text = 'Fahrt angehalten.'): void {
		if (status.value === 'running') {
			cancelFrames()
			status.value = 'paused'
			announce(text)
		}
	}

	function resume (): void {
		if (status.value === 'paused') {
			status.value = 'running'
			announce('Fahrt geht weiter.')
			frame = requestAnimationFrame(tick)
		}
	}

	// A new start or destination makes the ride meaningless; the route summary announces the new route.
	watch(route, () => {
		if (status.value !== 'idle') {
			stop()
		}
	})

	onScopeDispose(cancelFrames)

	const view = computed<RideView | undefined>(() => {
		const currentRoute = route.value
		const current = state.value
		if (!currentRoute || !current || status.value === 'idle') {
			return undefined
		}
		return {
			status: status.value,
			state: current,
			position: ridePosition(currentRoute, current),
			lineId: itemAt(currentRoute.legs, current.legIndex).lineId,
			stepped: stepped.value,
		}
	})

	/** Share of the route travelled, from 0 to 1. */
	const progress = computed(() => {
		const currentRoute = route.value
		const current = state.value
		return currentRoute && current && currentRoute.lengthMeters > 0 ? travelledMeters(currentRoute, current) / currentRoute.lengthMeters : 0
	})

	return { status, speed, message, view, progress, start, pause, resume, stop }
}
