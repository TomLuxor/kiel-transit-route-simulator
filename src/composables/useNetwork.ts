import { computed, type Ref } from 'vue'

import { LINES } from '@/data/lines'
import { PLACES } from '@/data/places'
import { buildNetwork, type Network } from '@/network/graph'
import { type ResolvedLine, resolveLine } from '@/network/lines'
import { type ResolvedPlace, resolvePlace } from '@/network/places'
import { type Section, sectionParts } from '@/network/sections'

export type NetworkModel =
	| { readonly state: 'empty' }
	| { readonly state: 'ready', readonly network: Network, readonly lines: readonly ResolvedLine[], readonly places: readonly ResolvedPlace[] }
	| { readonly state: 'error', readonly message: string }

/**
 * Builds the network graph, the lines and the places whenever the sections change. A failure here means the
 * WFS data no longer fits the line definitions (for example after the city changed the route), so it is
 * reported instead of drawing wrong lines.
 */
export function useNetwork (sections: Readonly<Ref<readonly Section[]>>) {
	// computed() does not wrap its value in deep reactive proxies, which suits the OpenLayers coordinates inside.
	return computed<NetworkModel>(() => {
		if (sections.value.length === 0) {
			return { state: 'empty' }
		}
		try {
			const network = buildNetwork(sectionParts(sections.value))
			const lines = LINES.map(line => resolveLine(network, line))
			const places = PLACES.map(place => resolvePlace(lines, place))
			return { state: 'ready', network, lines, places }
		} catch (error) {
			return { state: 'error', message: error instanceof Error ? error.message : 'Unbekannter Fehler.' }
		}
	})
}
