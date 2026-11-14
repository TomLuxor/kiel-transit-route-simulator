import { ref, shallowRef } from 'vue'

import { isSamePoint, type RoutePoint } from '@/network/routePoints'

export type Endpoint = 'start' | 'destination'

const OTHER: Readonly<Record<Endpoint, Endpoint>> = { start: 'destination', destination: 'start' }

/** The German words for the endpoints, with the articles their grammatical gender needs. */
export const ENDPOINT_WORDS: Readonly<Record<Endpoint, { title: string, nominative: string, accusative: string, another: string }>> = {
	start: { title: 'Start', nominative: 'der Start', accusative: 'den Start', another: 'einen anderen Start' },
	destination: { title: 'Ziel', nominative: 'das Ziel', accusative: 'das Ziel', another: 'ein anderes Ziel' },
}

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
			announce(`Dort liegt schon ${ENDPOINT_WORDS[OTHER[endpoint]].nominative}. Bitte ${ENDPOINT_WORDS[endpoint].another} wählen.`)
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
			announce('Dort ist keine Linie. Bitte näher an einer Linie klicken oder tippen.')
			return
		}
		const endpoint = clickTarget.value
		if (choose(endpoint, point)) {
			const next = clickTarget.value === endpoint ? '' : ` Der nächste Klick in die Karte wählt ${ENDPOINT_WORDS[clickTarget.value].accusative}.`
			announce(`${ENDPOINT_WORDS[endpoint].title}: ${point.name}.${next}`)
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
		announce('Start und Ziel getauscht.')
	}

	return { start: points.start, destination: points.destination, clickTarget, message, choose, chooseOnMap, swap }
}
