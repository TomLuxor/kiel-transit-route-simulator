import type { Coordinate } from 'ol/coordinate'

import Feature from 'ol/Feature'
import Point from 'ol/geom/Point'
import VectorLayer from 'ol/layer/Vector'
import VectorSource from 'ol/source/Vector'
import { Circle, Fill, Icon, Stroke, Style } from 'ol/style'

import type { LineDefinition, LineId } from '@/data/lines'
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

/** The vehicle: the front of a tram in the line's text color on a disc in the line color, with a white ring. */
function vehicleSvg (line: LineDefinition): string {
	return `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 36 36">
		<circle cx="18" cy="18" r="17.5" fill="${MAP_COLORS.casing}"/>
		<circle cx="18" cy="18" r="15" fill="${line.color}"/>
		<path d="M13.5 7.5h9M18 7.5v3" fill="none" stroke="${line.onColor}" stroke-width="2" stroke-linecap="round"/>
		<rect x="11" y="10.5" width="14" height="16" rx="3.5" fill="${line.onColor}"/>
		<rect x="13" y="13" width="10" height="6" rx="1.2" fill="${line.color}"/>
		<circle cx="14.5" cy="23" r="1.4" fill="${line.color}"/>
		<circle cx="21.5" cy="23" r="1.4" fill="${line.color}"/>
	</svg>`
}

const vehicleStyles = new Map<LineId, Style>()
function vehicleStyle (line: LineDefinition): Style {
	let style = vehicleStyles.get(line.id)
	if (!style) {
		style = new Style({ image: new Icon({ src: `data:image/svg+xml,${encodeURIComponent(vehicleSvg(line))}` }), zIndex: 1 })
		vehicleStyles.set(line.id, style)
	}
	return style
}

function marker (coordinate: Coordinate, style: Style[]): Feature {
	const feature = new Feature(new Point(coordinate))
	feature.setStyle(style)
	return feature
}

/** A layer with the start, destination and change markers and the vehicle, on its own canvas above the place names. */
export function createSelectionLayer (): {
	layer: VectorLayer
	showSelection: (start: RoutePoint | undefined, destination: RoutePoint | undefined, changes: readonly Coordinate[]) => void
	showVehicle: (vehicle: { coordinate: Coordinate, line: LineDefinition } | undefined) => void
} {
	const source = new VectorSource()
	const layer = new VectorLayer({ source, className: 'ol-layer route-markers' })
	let markers: Feature[] = []
	let vehicle: Feature<Point> | undefined

	function showSelection (start: RoutePoint | undefined, destination: RoutePoint | undefined, changes: readonly Coordinate[]): void {
		for (const feature of markers) {
			source.removeFeature(feature)
		}
		// Added in drawing order: changes below start and destination.
		markers = changes.map(change => marker(change, MARKER_STYLES.change))
		for (const [point, style] of [[start, MARKER_STYLES.start], [destination, MARKER_STYLES.destination]] as const) {
			if (point) {
				markers.push(marker(point.coordinate, style))
			}
		}
		source.addFeatures(markers)
	}

	/** Called on every animation frame during a ride, so it moves the one vehicle feature instead of replacing it. */
	function showVehicle (next: { coordinate: Coordinate, line: LineDefinition } | undefined): void {
		if (!next) {
			if (vehicle) {
				source.removeFeature(vehicle)
				vehicle = undefined
			}
			return
		}
		if (vehicle) {
			vehicle.getGeometry()?.setCoordinates(next.coordinate)
		} else {
			vehicle = new Feature(new Point(next.coordinate))
			source.addFeature(vehicle)
		}
		vehicle.setStyle(vehicleStyle(next.line))
	}

	return { layer, showSelection, showVehicle }
}
