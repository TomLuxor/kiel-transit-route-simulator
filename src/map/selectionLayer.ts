import type { Coordinate } from 'ol/coordinate'
import type OlMap from 'ol/Map'
import type { Pixel } from 'ol/pixel'

import Feature, { type FeatureLike } from 'ol/Feature'
import Point from 'ol/geom/Point'
import VectorLayer from 'ol/layer/Vector'
import VectorSource from 'ol/source/Vector'
import { Circle, Fill, Icon, Stroke, Style, Text } from 'ol/style'

import type { Endpoint } from '@/composables/useRouteSelection'
import type { LineDefinition, LineId } from '@/data/lines'
import type { RoutePoint } from '@/network/routePoints'

import { MAP_COLORS } from './colors'

/**
 * Start and destination as in the logo: the start a filled dark disc, the destination a signal-yellow disc
 * in a dark ring. They differ in shape, not only in color. Both sit on the same white halo, which sets them
 * off from the lines and covers the station dot or line badge below, so a marker on a place replaces its dot.
 * A change of line is a white disc in a dark ring, larger than the dots of the places.
 */
const halo = new Style({ image: new Circle({ radius: 13, fill: new Fill({ color: MAP_COLORS.casing }) }) })
const MARKER_STYLES: Readonly<Record<'start' | 'destination' | 'change', Style[]>> = {
	start: [
		halo,
		new Style({ image: new Circle({ radius: 9.5, fill: new Fill({ color: MAP_COLORS.onSignal }) }) }),
	],
	destination: [
		halo,
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

/** Where a point chosen on the map lies, in a box above its marker, so the list in the form can stay short. */
function nearbyStyle (text: string): Style {
	return new Style({
		text: new Text({
			text,
			font: '500 14px "Fira Sans", sans-serif',
			offsetY: -30,
			fill: new Fill({ color: MAP_COLORS.ink }),
			backgroundFill: new Fill({ color: MAP_COLORS.casing }),
			backgroundStroke: new Stroke({ color: MAP_COLORS.ink, width: 1 }),
			padding: [3, 6, 1, 6],
		}),
	})
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
	endpointAt: (map: OlMap, pixel: Pixel, hitTolerance: number) => Endpoint | undefined
} {
	const source = new VectorSource()
	const layer = new VectorLayer({ source, className: 'ol-layer route-markers' })
	let markers: Feature[] = []
	/** The start and destination markers, for dragging them; not their name boxes, which are features of their own. */
	const endpoints = new Map<FeatureLike, Endpoint>()
	let vehicle: Feature<Point> | undefined

	function showSelection (start: RoutePoint | undefined, destination: RoutePoint | undefined, changes: readonly Coordinate[]): void {
		for (const feature of markers) {
			source.removeFeature(feature)
		}
		endpoints.clear()
		// Added in drawing order: changes below start and destination, the name boxes above all markers.
		markers = changes.map(change => marker(change, MARKER_STYLES.change))
		const chosen = [['start', start], ['destination', destination]] as const
		for (const [endpoint, point] of chosen) {
			if (point) {
				const feature = marker(point.coordinate, MARKER_STYLES[endpoint])
				endpoints.set(feature, endpoint)
				markers.push(feature)
			}
		}
		for (const [, point] of chosen) {
			if (point?.nearby) {
				markers.push(marker(point.coordinate, [nearbyStyle(point.nearby)]))
			}
		}
		source.addFeatures(markers)
	}

	/** The start or destination marker at a pixel, or undefined; the vehicle and the change markers do not count. */
	function endpointAt (map: OlMap, pixel: Pixel, hitTolerance: number): Endpoint | undefined {
		return map.forEachFeatureAtPixel(pixel, feature => endpoints.get(feature), { layerFilter: candidate => candidate === layer, hitTolerance })
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

	return { layer, showSelection, showVehicle, endpointAt }
}
