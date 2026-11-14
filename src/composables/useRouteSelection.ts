import { ref, shallowRef } from 'vue'

import { isSamePoint, type RoutePoint } from '@/network/routePoints'

export type Endpoint = 'start' | 'destination'

const OTHER: Readonly<Record<Endpoint, Endpoint>> = { start: 'destination', destination: 'start' }
const TITLE: Readonly<Record<Endpoint, string>> = { start: 'Start', destination: 'Destination' }

/**
 * Start and destination of the ride, chosen in the form or with a click on the map.
 *
 * A map click sets the endpoint in `clickTarget`. When one endpoint is set while the other is still empty,
 * the target moves on to the empty one, so that two clicks choose start and destination.
 */
export function useRouteSelection () {
	const points = { start: shallowRef<RoutePoint>(), destination: shallowRef<RoutePoint>() }
	const clickTarget = ref<Endpoint>('start')
	/** Text for a polite live region: the result of a map click, or why a choice was not taken. */
	const message = ref('')

	function announce (text: string): void {
		// A live region only speaks when its text changes, so a repeated message gets an invisible difference.
		message.value = message.value === text ? `${text}\u00A0` : text
	}

	/** Sets an endpoint; refuses a point where the other endpoint already is and says why. */
	function choose (endpoint: Endpoint, point: RoutePoint): boolean {
		const other = points[OTHER[endpoint]].value
		if (other && isSamePoint(point, other)) {
			announce(`That is where the ${OTHER[endpoint]} is. Choose another ${endpoint}.`)
			return false
		}
		points[endpoint].value = point
		if (!other) {
			clickTarget.value = OTHER[endpoint]
		}
		return true
	}

	/** A map click: `point` is undefined if the click was too far from every line. */
	function chooseOnMap (point: RoutePoint | undefined): void {
		if (!point) {
			announce('There is no line there. Click or tap closer to a line.')
			return
		}
		const endpoint = clickTarget.value
		if (choose(endpoint, point)) {
			const next = clickTarget.value === endpoint ? '' : ` A click on the map now sets the ${clickTarget.value}.`
			announce(`${TITLE[endpoint]}: ${point.name}.${next}`)
		}
	}

	function swap (): void {
		const { start, destination } = points
		const previousStart = start.value
		start.value = destination.value
		destination.value = previousStart
		if (!start.value) {
			clickTarget.value = 'start'
		} else if (!destination.value) {
			clickTarget.value = 'destination'
		}
		announce('Start and destination swapped.')
	}

	return { start: points.start, destination: points.destination, clickTarget, message, choose, chooseOnMap, swap }
}
