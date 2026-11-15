import Feature from 'ol/Feature'
import Point from 'ol/geom/Point'
import VectorLayer from 'ol/layer/Vector'
import VectorSource from 'ol/source/Vector'
import { Circle, Fill, Stroke, Style, Text } from 'ol/style'

import type { LineDefinition, LineId } from '@/data/lines'
import type { ResolvedLine } from '@/network/lines'
import type { ResolvedPlace } from '@/network/places'

import { distanceMeters } from '@/network/geometry'

import { fadedColor, MAP_COLORS } from './colors'

const BADGE_RADIUS = 12
const DOT_RADIUS = 5
/** Space between a dot or badge and the place name, in pixels. */
const LABEL_GAP = 8
/**
 * A place this close to a line end is marked by the line's badge instead of a dot. Seven places lie at a
 * line end (within 0.2 m); the next closest, Am Langsee, is 98 m from the end of line 4.
 */
const AT_LINE_END_METERS = 5

/**
 * The line number on a disc in the line color, as on transit signs. Names never cover it. Washed out like
 * its line while another line is highlighted.
 */
function badgeStyle (line: LineDefinition, faded: boolean): Style {
	return new Style({
		image: new Circle({
			radius: BADGE_RADIUS,
			fill: new Fill({ color: faded ? fadedColor(line.color) : line.color }),
			stroke: new Stroke({ color: MAP_COLORS.casing, width: 2 }),
			declutterMode: 'obstacle',
		}),
		text: new Text({
			text: line.id,
			font: '600 14px "Fira Sans", sans-serif',
			fill: new Fill({ color: faded ? fadedColor(line.onColor) : line.onColor }),
			declutterMode: 'obstacle',
		}),
	})
}

/** A station dot on the line. Names never cover it. */
const dotStyle = new Style({
	image: new Circle({
		radius: DOT_RADIUS,
		fill: new Fill({ color: MAP_COLORS.casing }),
		stroke: new Stroke({ color: MAP_COLORS.ink, width: 2 }),
		declutterMode: 'obstacle',
	}),
})

function labelStyle (place: ResolvedPlace, besideBadge: boolean): Style {
	const offset = (besideBadge ? BADGE_RADIUS : DOT_RADIUS) + LABEL_GAP
	const left = place.definition.labelSide === 'left'
	return new Style({
		text: new Text({
			text: place.definition.name,
			font: '500 14px "Fira Sans", sans-serif',
			textAlign: left ? 'right' : 'left',
			offsetX: left ? -offset : offset,
			fill: new Fill({ color: MAP_COLORS.ink }),
			stroke: new Stroke({ color: MAP_COLORS.casing, width: 4 }),
		}),
	})
}

/**
 * The line number badges at the line ends and the named places as station dots with their names. Where a
 * line ends at a place, the badge marks the place instead of a dot. Names that would overlap a badge, a dot
 * or another name are left out until the map is zoomed in (decluttering).
 */
export function createPlaceLayer (): {
	layer: VectorLayer
	showPlaces: (places: readonly ResolvedPlace[], lines: readonly ResolvedLine[]) => void
	highlight: (lineId: LineId | undefined) => void
} {
	const source = new VectorSource()
	const layer = new VectorLayer({ source, declutter: true })
	let badgeFeatures: { feature: Feature, line: LineDefinition }[] = []

	function showPlaces (places: readonly ResolvedPlace[], lines: readonly ResolvedLine[]): void {
		const badges = lines.flatMap(line => [line.coordinates[0], line.coordinates[line.coordinates.length - 1]]
			.filter(end => end !== undefined)
			.map(end => ({ end, line: line.definition })))
		badgeFeatures = badges.map(({ end, line }) => {
			const feature = new Feature(new Point(end))
			feature.setStyle(badgeStyle(line, false))
			return { feature, line }
		})
		const features = badgeFeatures.map(({ feature }) => feature)
		// Features added first win when names overlap: badges and dots always stay, then the busiest places.
		for (const place of [...places].sort((a, b) => b.lineIds.length - a.lineIds.length)) {
			const badge = badges.find(({ end }) => distanceMeters(end, place.coordinate) < AT_LINE_END_METERS)
			// Beside a badge, the name is placed relative to the badge, so that it never touches it.
			const feature = new Feature(new Point(badge?.end ?? place.coordinate))
			feature.setStyle(badge ? labelStyle(place, true) : [dotStyle, labelStyle(place, false)])
			features.push(feature)
		}
		source.clear()
		source.addFeatures(features)
	}

	/** The badges of every line but `lineId` washed out; undefined shows all alike. */
	function highlight (lineId: LineId | undefined): void {
		for (const { feature, line } of badgeFeatures) {
			feature.setStyle(badgeStyle(line, lineId !== undefined && lineId !== line.id))
		}
	}

	return { layer, showPlaces, highlight }
}
