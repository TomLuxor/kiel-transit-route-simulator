import type { Coordinate } from 'ol/coordinate'

import { easeOut, inAndOut } from 'ol/easing'
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
import { animationDuration } from './motion'

const BADGE_RADIUS = 12
const DOT_RADIUS = 5
/** Space between a dot or badge and the place name, in pixels. */
const LABEL_GAP = 8
/**
 * A place this close to a line end is marked by the line's badge instead of a dot. Seven places lie at a
 * line end (within 0.2 m); the next closest, Am Langsee, is 98 m from the end of line 4.
 */
const AT_LINE_END_METERS = 5

/** A station with the start or destination pin on it is drawn this much larger: its dot, or its line badge. */
const CHOSEN_SCALE = { dot: 1.3, badge: 1.1 } as const
/** When a pin lands on a station, its dot or badge first swells this much beyond that size, then settles. */
const POP_SCALE = 1.45
/** Length of that pop in milliseconds; a station the pin leaves shrinks back in half the time. */
const POP_MS = 450
/** Share of the pop spent swelling; the rest it settles. */
const POP_RISE = 0.35

/**
 * Obstacles keep names off the dots and badges. While a dot or badge pops, it is no obstacle, or its own name
 * and its neighbors' would blink out for a moment as it swells.
 */
function declutterMode (steady: boolean): 'obstacle' | 'none' {
	return steady ? 'obstacle' : 'none'
}

/**
 * The line number on a disc in the line color, as on transit signs. Names never cover it. Washed out like
 * its line while another line is highlighted.
 */
function badgeStyle (line: LineDefinition, faded: boolean, scale: number, steady: boolean): Style {
	return new Style({
		image: new Circle({
			radius: BADGE_RADIUS,
			scale,
			fill: new Fill({ color: faded ? fadedColor(line.color) : line.color }),
			stroke: new Stroke({ color: MAP_COLORS.casing, width: 2 }),
			declutterMode: declutterMode(steady),
		}),
		text: new Text({
			text: line.id,
			scale,
			font: '600 14px "Fira Sans", sans-serif',
			fill: new Fill({ color: faded ? fadedColor(line.onColor) : line.onColor }),
			declutterMode: declutterMode(steady),
		}),
	})
}

/** A station dot on the line. Names never cover it. */
function dotStyle (scale: number, steady: boolean): Style {
	return new Style({
		image: new Circle({
			radius: DOT_RADIUS,
			scale,
			fill: new Fill({ color: MAP_COLORS.casing }),
			stroke: new Stroke({ color: MAP_COLORS.ink, width: 2 }),
			declutterMode: declutterMode(steady),
		}),
	})
}

const restingDotStyle = dotStyle(1, true)

/**
 * The name of a place beside its dot or badge; bold while the start or destination is on it, and as much
 * further away as the dot or badge has grown, or it would touch it and be left out.
 */
function labelStyle (place: ResolvedPlace, besideBadge: boolean, chosen: boolean): Style {
	const radius = besideBadge ? BADGE_RADIUS * (chosen ? CHOSEN_SCALE.badge : 1) : DOT_RADIUS * (chosen ? CHOSEN_SCALE.dot : 1)
	const offset = radius + LABEL_GAP + (chosen ? 1 : 0)
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

/** A dot or badge changing size: from one scale to another, through a peak when a pin lands on it. */
interface Pop {
	readonly startTime: number
	readonly duration: number
	readonly from: number
	readonly to: number
	readonly peak: number | undefined
}

function scaleAt (pop: Pop, time: number): number {
	const t = Math.min(1, Math.max(0, (time - pop.startTime) / pop.duration))
	if (pop.peak === undefined) {
		return pop.from + (pop.to - pop.from) * easeOut(t)
	}
	if (t < POP_RISE) {
		return pop.from + (pop.peak - pop.from) * easeOut(t / POP_RISE)
	}
	return pop.peak + (pop.to - pop.peak) * inAndOut((t - POP_RISE) / (1 - POP_RISE))
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
	/** The scale of each dot or badge that is not at its normal size, by place ID. */
	const scales = new Map<string, number>()
	const pops = new Map<string, Pop>()
	let frame: number | undefined

	function styleBadges (): void {
		for (const { feature, line, placeId } of badgeFeatures) {
			const faded = highlighted !== undefined && highlighted !== line.id
			const scale = placeId === undefined ? 1 : scales.get(placeId) ?? 1
			feature.setStyle(badgeStyle(line, faded, scale, placeId === undefined || !pops.has(placeId)))
		}
	}

	function stylePlaces (): void {
		for (const { feature, place, besideBadge } of placeFeatures) {
			const id = place.definition.id
			const label = labelStyle(place, besideBadge, chosen.includes(id))
			const scale = scales.get(id)
			const dot = scale === undefined ? restingDotStyle : dotStyle(scale, !pops.has(id))
			feature.setStyle(besideBadge ? label : [dot, label])
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

	/** One animation frame for every dot or badge that pops or shrinks. */
	function step (time: number): void {
		frame = undefined
		for (const [id, pop] of pops) {
			scales.set(id, scaleAt(pop, time))
			if (time >= pop.startTime + pop.duration) {
				pops.delete(id)
				if (pop.to === 1) {
					scales.delete(id)
				}
			}
		}
		styleBadges()
		stylePlaces()
		if (pops.size > 0) {
			frame = requestAnimationFrame(step)
		}
	}

	/**
	 * Marks the places the start or destination is on: their dot or badge pops when a pin lands and stays a
	 * little larger, and shrinks back when the pin leaves. Called while a pin is dragged, so only on a change.
	 * With reduced motion the size changes at once.
	 */
	function markChosen (placeIds: readonly string[]): void {
		if (placeIds.length === chosen.length && placeIds.every(id => chosen.includes(id))) {
			return
		}
		const startTime = performance.now()
		const duration = animationDuration(POP_MS)
		const atBadge = new Set(badgeFeatures.map(({ placeId }) => placeId))
		for (const id of new Set([...placeIds, ...chosen])) {
			const landing = placeIds.includes(id)
			if (landing === chosen.includes(id)) {
				continue
			}
			const to = landing ? CHOSEN_SCALE[atBadge.has(id) ? 'badge' : 'dot'] : 1
			if (duration === 0) {
				pops.delete(id)
				scales.set(id, to)
				continue
			}
			const from = scales.get(id) ?? 1
			pops.set(id, landing
				? { startTime, duration, from, to, peak: to * POP_SCALE }
				: { startTime, duration: duration / 2, from, to, peak: undefined })
		}
		chosen = placeIds
		for (const [id, scale] of scales) {
			if (scale === 1 && !pops.has(id)) {
				scales.delete(id)
			}
		}
		styleBadges()
		stylePlaces()
		if (pops.size > 0 && frame === undefined) {
			frame = requestAnimationFrame(step)
		}
	}

	return { layer, showPlaces, highlight, markChosen }
}
