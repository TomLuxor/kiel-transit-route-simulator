import { describe, expect, it } from 'vitest'

import type { RoutePoint } from '@/network/routePoints'

import { at } from '@/network/__tests__/kielNetwork'

import { useRouteSelection } from '../useRouteSelection'

const point = (id: string, lon: number): RoutePoint => ({ kind: 'place', id, name: id, coordinate: at(lon, 54.32), lineIds: ['1'] })
const a = point('A', 10.10)
const b = point('B', 10.12)
const c = point('C', 10.14)

describe('choosing start and destination', () => {
	it('sets the start with the first click and the destination with the second', () => {
		const selection = useRouteSelection()
		selection.chooseOnMap(a)
		expect(selection.start.value).toBe(a)
		expect(selection.clickTarget.value).toBe('destination')
		expect(selection.message.value).toBe('Start: A. Der nächste Klick in die Karte wählt das Ziel.')

		selection.chooseOnMap(b)
		expect(selection.destination.value).toBe(b)
		expect(selection.message.value).toBe('Ziel: B.')

		// Further clicks replace the destination until the user picks the start in the form.
		selection.chooseOnMap(c)
		expect(selection.start.value).toBe(a)
		expect(selection.destination.value).toBe(c)
	})

	it('moves the click target to the start when only the destination is set', () => {
		const selection = useRouteSelection()
		selection.choose('destination', b)
		expect(selection.clickTarget.value).toBe('start')
	})

	it('refuses a destination where the start is, and says why', () => {
		const selection = useRouteSelection()
		selection.choose('start', a)
		expect(selection.choose('destination', a)).toBe(false)
		expect(selection.destination.value).toBeUndefined()
		expect(selection.message.value).toBe('Dort liegt schon der Start. Bitte ein anderes Ziel wählen.')
	})

	it('swaps start and destination and then targets the empty one', () => {
		const selection = useRouteSelection()
		selection.choose('start', a)
		selection.swap()
		expect(selection.start.value).toBeUndefined()
		expect(selection.destination.value).toBe(a)
		expect(selection.clickTarget.value).toBe('start')
	})

	it('changes the message text on a repeated miss, so that screen readers announce it again', () => {
		const selection = useRouteSelection()
		selection.chooseOnMap(undefined)
		const first = selection.message.value
		selection.chooseOnMap(undefined)
		expect(selection.message.value).not.toBe(first)
		expect(selection.message.value.trim()).toBe(first)
	})
})
