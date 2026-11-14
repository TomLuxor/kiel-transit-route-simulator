import type { Coordinate } from 'ol/coordinate'

import Feature from 'ol/Feature'
import Point from 'ol/geom/Point'
import VectorLayer from 'ol/layer/Vector'
import VectorSource from 'ol/source/Vector'
import { Circle, Fill, Stroke, Style } from 'ol/style'

import type { RoutePoint } from '@/network/routePoints'

import { MAP_COLORS } from './colors'

/**
 * Start and destination as in the logo: the start a filled dark disc, the destination a signal-yellow disc
 * in a dark ring. They differ in shape, not only in color, and a white ring sets both off from the lines.
 * A change of line is a white disc in a dark ring, larger than the dots of the places.
 */
const MARKER_STYLES: Readonly<Record<'start' | 'destination' | 'change', Style[]>> = {
	start: [new Style({
		image: new Circle({ radius: 9, fill: new Fill({ color: MAP_COLORS.onSignal }), stroke: new Stroke({ color: MAP_COLORS.casing, width: 3 }) }),
	})],
	destination: [
		new Style({ image: new Circle({ radius: 13, fill: new Fill({ color: MAP_COLORS.casing }) }) }),
		new Style({ image: new Circle({ radius: 9, fill: new Fill({ color: MAP_COLORS.signal }), stroke: new Stroke({ color: MAP_COLORS.onSignal, width: 4 }) }) }),
	],
	change: [new Style({
		image: new Circle({ radius: 8, fill: new Fill({ color: MAP_COLORS.casing }), stroke: new Stroke({ color: MAP_COLORS.ink, width: 3 }) }),
	})],
}

function marker (coordinate: Coordinate, style: Style[]): Feature {
	const feature = new Feature(new Point(coordinate))
	feature.setStyle(style)
	return feature
}

/** A layer with the start, destination and change markers, on its own canvas above the place names. */
export function createSelectionLayer (): {
	layer: VectorLayer
	showSelection: (start: RoutePoint | undefined, destination: RoutePoint | undefined, changes: readonly Coordinate[]) => void
} {
	const source = new VectorSource()
	const layer = new VectorLayer({ source, className: 'ol-layer route-markers' })

	function showSelection (start: RoutePoint | undefined, destination: RoutePoint | undefined, changes: readonly Coordinate[]): void {
		// Added in drawing order: changes below start and destination.
		const features = changes.map(change => marker(change, MARKER_STYLES.change))
		for (const [point, style] of [[start, MARKER_STYLES.start], [destination, MARKER_STYLES.destination]] as const) {
			if (point) {
				features.push(marker(point.coordinate, style))
			}
		}
		source.clear()
		source.addFeatures(features)
	}

	return { layer, showSelection }
}
