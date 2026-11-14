import Feature from 'ol/Feature'
import LineString from 'ol/geom/LineString'
import VectorLayer from 'ol/layer/Vector'
import VectorSource from 'ol/source/Vector'
import { Stroke, Style } from 'ol/style'

import type { Route } from '@/routing/route'

import { LINES } from '@/data/lines'

import { MAP_COLORS } from './colors'

/** Twice the width of a line on the network, so the route stands out even on the four-line trunk. */
const ROUTE_WIDTH = 8
const CASING_WIDTH = 3

/** Opacity of the line layer while a route is shown, so the route stands out. */
export const DIMMED_LINE_OPACITY = 0.35

function legStyles (color: string): Style[] {
	return [
		new Style({ stroke: new Stroke({ color: MAP_COLORS.casing, width: ROUTE_WIDTH + 2 * CASING_WIDTH, lineCap: 'round', lineJoin: 'round' }), zIndex: 0 }),
		new Style({ stroke: new Stroke({ color, width: ROUTE_WIDTH, lineCap: 'round', lineJoin: 'round' }), zIndex: 1 }),
	]
}

/** The route: each leg in the color of its line, wide and with a white casing. */
export function createRouteLayer (): { layer: VectorLayer, showRoute: (route: Route | undefined) => void } {
	const source = new VectorSource()
	const layer = new VectorLayer({ source })

	function showRoute (route: Route | undefined): void {
		source.clear()
		source.addFeatures((route?.legs ?? []).map(leg => {
			const feature = new Feature(new LineString([...leg.coordinates]))
			feature.setStyle(legStyles(LINES.find(line => line.id === leg.lineId)?.color ?? MAP_COLORS.ink))
			return feature
		}))
	}

	return { layer, showRoute }
}
