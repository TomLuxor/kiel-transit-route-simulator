import type { Coordinate } from 'ol/coordinate'

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
/** A station with the start or destination on it: its dot and the ring of its badge 1 px larger. */
const CHOSEN_GROWTH = 1
/** Space between a dot or badge and the place name, in pixels. */
const LABEL_GAP = 8
/**
 * A place this close to a line end is marked by the line's badge instead of a dot. Seven places lie at a
 * line end (within 0.2 m); the next closest, Am Langsee, is 98 m from the end of line 4.
 */
const AT_LINE_END_METERS = 5

/**
 * The line number on a disc in the line color, as on transit signs. Names never cover it. Washed out like
 * its line while another line is highlighted; with a dark ring while the start or destination is on it.
 */
function badgeStyle (line: LineDefinition, faded: boolean, chosen: boolean): Style {
	return new Style({
		image: new Circle({
			radius: BADGE_RADIUS,
			fill: new Fill({ color: faded ? fadedColor(line.color) : line.color }),
			stroke: chosen ? new Stroke({ color: MAP_COLORS.ink, width: 3 }) : new Stroke({ color: MAP_COLORS.casing, width: 2 }),
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

/** A station with the start or destination pin on it: the dot a little larger and filled dark. */
const chosenDotStyle = new Style({
	image: new Circle({
		radius: DOT_RADIUS + CHOSEN_GROWTH,
		fill: new Fill({ color: MAP_COLORS.ink }),
		stroke: new Stroke({ color: MAP_COLORS.casing, width: 2 }),
		declutterMode: 'obstacle',
	}),
})

/**
 * The name of a place beside its dot or badge; bold while the start or destination is on it, and as much
 * further away as the dot grows, or it would touch its own dot and be left out (on the left side).
 */
function labelStyle (place: ResolvedPlace, besideBadge: boolean, chosen: boolean): Style {
	const offset = (besideBadge ? BADGE_RADIUS : DOT_RADIUS) + LABEL_GAP + (chosen ? CHOSEN_GROWTH : 0)
	const left = place.definition.labelSide === 'left'
	return new Style({
		text: new Text({
			text: place.definition.name,
			font: `${chosen ? '700' : '500'} 14px "Fira Sans", sans-serif`,
			textAlign: left ? 'right' : 'left',
			offsetX: left ? -offset : offset,
			fill: new Fill({ color: MAP_COLORS.ink }),
			stroke: new Stroke({ color: MAP_COLORS.casing, width: 4 }),
		}),
	})
}

/** A badge at a line end, and the place there, if there is one. */
interface BadgeFeature {
	readonly feature: Feature
	readonly line: LineDefinition
	readonly placeId: string | undefined
}

/** A place: its name, beside a badge, or its dot and name. */
interface PlaceFeature {
	readonly feature: Feature
	readonly place: ResolvedPlace
	readonly besideBadge: boolean
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
	markChosen: (placeIds: readonly string[]) => void
} {
	const source = new VectorSource()
	const layer = new VectorLayer({ source, declutter: true })
	let badgeFeatures: BadgeFeature[] = []
	let placeFeatures: PlaceFeature[] = []
	let highlighted: LineId | undefined
	/** The places the start or destination is on. */
	let chosen: readonly string[] = []

	function styleBadges (): void {
		for (const { feature, line, placeId } of badgeFeatures) {
			const faded = highlighted !== undefined && highlighted !== line.id
			feature.setStyle(badgeStyle(line, faded, placeId !== undefined && chosen.includes(placeId)))
		}
	}

	function stylePlaces (): void {
		for (const { feature, place, besideBadge } of placeFeatures) {
			const isChosen = chosen.includes(place.definition.id)
			const label = labelStyle(place, besideBadge, isChosen)
			feature.setStyle(besideBadge ? label : [isChosen ? chosenDotStyle : dotStyle, label])
		}
	}

	function showPlaces (places: readonly ResolvedPlace[], lines: readonly ResolvedLine[]): void {
		const ends = lines.flatMap(line => [line.coordinates[0], line.coordinates[line.coordinates.length - 1]]
			.filter(end => end !== undefined)
			.map(end => ({ end, line: line.definition })))
		const placeAt = (end: Coordinate): ResolvedPlace | undefined =>
			places.find(place => distanceMeters(end, place.coordinate) < AT_LINE_END_METERS)
		badgeFeatures = ends.map(({ end, line }) => ({ feature: new Feature(new Point(end)), line, placeId: placeAt(end)?.definition.id }))
		// Features added first win when names overlap: badges and dots always stay, then the busiest places.
		placeFeatures = [...places].sort((a, b) => b.lineIds.length - a.lineIds.length).map(place => {
			const badge = ends.find(({ end }) => distanceMeters(end, place.coordinate) < AT_LINE_END_METERS)
			// Beside a badge, the name is placed relative to the badge, so that it never touches it.
			return { feature: new Feature(new Point(badge?.end ?? place.coordinate)), place, besideBadge: badge !== undefined }
		})
		styleBadges()
		stylePlaces()
		source.clear()
		source.addFeatures([...badgeFeatures, ...placeFeatures].map(({ feature }) => feature))
	}

	/** The badges of every line but `lineId` washed out; undefined shows all alike. */
	function highlight (lineId: LineId | undefined): void {
		highlighted = lineId
		styleBadges()
	}

	/** Marks the places the start or destination is on; called while a pin is dragged, so only on a change. */
	function markChosen (placeIds: readonly string[]): void {
		if (placeIds.length === chosen.length && placeIds.every(id => chosen.includes(id))) {
			return
		}
		chosen = placeIds
		styleBadges()
		stylePlaces()
	}

	return { layer, showPlaces, highlight, markChosen }
}
