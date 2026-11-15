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
import { PIN } from './pin'

/**
 * A pin (see pin.ts) as an SVG drawing: a faint shadow under the tip, a white outline that sets it off from
 * lines and map, the body, and the dot in its head.
 */
function pinSvg (body: string, outline: string | undefined, dot: string): string {
	const { width, height, path, dot: { x, y, radius } } = PIN
	const stroke = outline ? ` stroke="${outline}" stroke-width="2.5"` : ''
	return `<svg xmlns="http://www.w3.org/2000/svg" width="${String(width)}" height="${String(height)}" viewBox="0 0 ${String(width)} ${String(height)}">
		<ellipse cx="${String(PIN.tip[0])}" cy="${String(PIN.tip[1] + 1)}" rx="6" ry="2" fill="#000000" fill-opacity="0.3"/>
		<path d="${path}" fill="${MAP_COLORS.casing}" stroke="${MAP_COLORS.casing}" stroke-width="5" stroke-linejoin="round"/>
		<path d="${path}" fill="${body}"${stroke} stroke-linejoin="round"/>
		<circle cx="${String(x)}" cy="${String(y)}" r="${String(radius)}" fill="${dot}"/>
	</svg>`
}

function pinStyle (svg: string): Style {
	return new Style({
		image: new Icon({ src: `data:image/svg+xml,${encodeURIComponent(svg)}`, anchor: [...PIN.tip], anchorXUnits: 'pixels', anchorYUnits: 'pixels' }),
	})
}

/**
 * Start and destination as pins, in the colors of the logo: the start black with a white dot, the destination
 * signal yellow in a black outline with a black dot; they differ in lightness, not only in hue. A change of
 * line is a white disc in a dark ring, larger than the dots of the places.
 */
const MARKER_STYLES: Readonly<Record<'start' | 'destination' | 'change', Style[]>> = {
	start: [pinStyle(pinSvg(MAP_COLORS.onSignal, undefined, MAP_COLORS.casing))],
	destination: [pinStyle(pinSvg(MAP_COLORS.signal, MAP_COLORS.onSignal, MAP_COLORS.onSignal))],
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

/** Where a point chosen on the map lies, in a box above its pin, so the list in the form can stay short. */
function nearbyStyle (text: string): Style {
	return new Style({
		text: new Text({
			text,
			font: '500 14px "Fira Sans", sans-serif',
			offsetY: -56,
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
