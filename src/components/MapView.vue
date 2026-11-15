<script setup lang="ts">
import type { Coordinate } from 'ol/coordinate'
import type MapBrowserEvent from 'ol/MapBrowserEvent'

import 'ol/ol.css'
import { equals } from 'ol/coordinate'
import { boundingExtent, buffer, containsCoordinate } from 'ol/extent'
import { defaults as defaultInteractions } from 'ol/interaction/defaults'
import PointerInteraction from 'ol/interaction/Pointer'
import OlMap from 'ol/Map'
import { fromLonLat } from 'ol/proj'
import View from 'ol/View'
import { computed, onBeforeUnmount, onMounted, ref, useTemplateRef, watch } from 'vue'

import type { RideView } from '@/composables/useRide'
import type { Endpoint } from '@/composables/useRouteSelection'
import type { LineId } from '@/data/lines'
import type { Network } from '@/network/graph'
import type { ResolvedLine } from '@/network/lines'
import type { ResolvedPlace } from '@/network/places'

import { LINES } from '@/data/lines'
import { INITIAL_ZOOM, KIEL_CENTER, MAP_PROJECTION } from '@/map/config'
import { createControls, createFitControl } from '@/map/controls'
import { createBackgroundLayer } from '@/map/layers'
import { createLineLayer } from '@/map/lineLayer'
import { animationDuration } from '@/map/motion'
import { createPlaceLayer } from '@/map/placeLayer'
import { createRouteLayer, DIMMED_LINE_OPACITY } from '@/map/routeLayer'
import { createSelectionLayer } from '@/map/selectionLayer'
import { dragPoint, isSamePoint, pickPoint, type RoutePoint } from '@/network/routePoints'
import { findRoute, type Route } from '@/routing/route'

import MapHint from './MapHint.vue'

const props = defineProps<{
	network: Network | undefined
	lines: readonly ResolvedLine[]
	places: readonly ResolvedPlace[]
	start: RoutePoint | undefined
	destination: RoutePoint | undefined
	route: Route | undefined
	ride: RideView | undefined
	/** Whether a click on a line chooses a point; not during a ride. */
	picking: boolean
	/** A line pointed at in the legend: the others are washed out. */
	highlightedLine: LineId | undefined
	/** The endpoint to tell the user to set with a click, as long as start or destination is missing. */
	hint: Endpoint | undefined
}>()

const emit = defineEmits<{
	/** A click on the map: the chosen point, or undefined if the click was too far from every line. */
	pick: [point: RoutePoint | undefined]
	/** The start or destination was dragged along the lines to `point` and dropped there. */
	move: [endpoint: Endpoint, point: RoutePoint]
	/** The user drags the map. */
	pan: []
}>()

/**
 * A point chosen in the form is brought into view if it lies closer than this to the map edge, in pixels;
 * less than the padding of the overview, so that choosing a line end does not move the whole network.
 */
const REVEAL_MARGIN_PIXELS = 16

/** Zoom level while following the vehicle: streets and place names are readable. */
const RIDE_ZOOM = 15

/** How far around the start and destination markers a press grabs them, in pixels; more for a fingertip. */
const GRAB_TOLERANCE_PIXELS = { mouse: 4, touch: 12 }

// The ref key must differ from every script variable (here `map`), or Vue cannot set it.
const mapElement = useTemplateRef<HTMLDivElement>('mapTarget')
const backgroundLayer = createBackgroundLayer()
const lineLayer = createLineLayer()
const routeLayer = createRouteLayer()
const placeLayer = createPlaceLayer()
const selectionLayer = createSelectionLayer()
let map: OlMap | undefined

/**
 * Padding for fitting the view, in pixels (top, right, bottom, left): a margin of `pixels`, plus the attributions,
 * which cover the bottom of the map, more so on phones, and the hint, while there is one, the top (MapHint.vue,
 * next to the map element).
 */
function fitPadding (pixels: number): [number, number, number, number] {
	const attribution = mapElement.value?.querySelector<HTMLElement>('.ol-attribution')
	const hint = props.hint && mapElement.value?.parentElement?.querySelector<HTMLElement>('.map-hint')
	// The hint stands in the overlay at the top of the map; offsets, unlike its bounding box, ignore its slide-in.
	const overlay = hint?.offsetParent
	const hintBottom = hint ? (overlay instanceof HTMLElement ? overlay.offsetTop : 0) + hint.offsetTop + hint.offsetHeight : 0
	return [pixels + hintBottom, pixels, pixels + (attribution?.offsetHeight ?? 0), pixels]
}

/**
 * Tiles of the background map that failed in a row, with none loaded in between. From three on, the background map
 * counts as unreachable; a single failed tile among loaded ones is no reason to tell the user.
 */
let failedTiles = 0
const FAILED_TILES_NOTICE = 3
const basemapFailed = ref(false)
backgroundLayer.getSource()?.on('tileloaderror', () => {
	failedTiles += 1
	basemapFailed.value = failedTiles >= FAILED_TILES_NOTICE
})
backgroundLayer.getSource()?.on('tileloadend', () => {
	failedTiles = 0
	basemapFailed.value = false
})

/** Shown once the network is there: before, the status bar of the page tells about loading and its errors. */
const basemapNotice = computed(() => basemapFailed.value && props.lines.length > 0)

/** Loads the tiles of the background map again, the failed ones too. */
function retryBasemap (): void {
	failedTiles = 0
	basemapFailed.value = false
	backgroundLayer.getSource()?.refresh()
}

/**
 * Margin around the whole network, in pixels. Half of it on a small map (a phone's, whose smaller side is below
 * 480 px), where the full margin, the hint and the attributions would leave the network only half of the height.
 */
const NETWORK_MARGIN_PIXELS = 32
const SMALL_MAP_PIXELS = 480

/**
 * Room right of the network, in pixels, for the names of its eastern ends (Dietrichsdorf, Elmschenhagen), which
 * stand right of their badges and would otherwise run off the map where it is narrow.
 */
const EAST_NAMES_PIXELS = 120

/** The whole network in view; animated when the user asks for it with the button. */
function fitNetwork (duration = 0): void {
	const extent = lineLayer.layer.getSource()?.getExtent()
	const element = mapElement.value
	if (map && element && extent && props.lines.length > 0) {
		const small = Math.min(element.clientWidth, element.clientHeight) < SMALL_MAP_PIXELS
		const [top, right, bottom, left] = fitPadding(small ? NETWORK_MARGIN_PIXELS / 2 : NETWORK_MARGIN_PIXELS)
		map.getView().fit(extent, { padding: [top, right + EAST_NAMES_PIXELS, bottom, left], duration })
	}
}

function showNetwork (): void {
	if (!props.network || props.lines.length === 0) {
		return
	}
	lineLayer.showLines(props.network, props.lines)
	placeLayer.showPlaces(props.places, props.lines)
	fitNetwork()
}

/** What a click at `coordinate` would choose at the current zoom. */
function pointAt (coordinate: Coordinate): RoutePoint | undefined {
	const resolution = map?.getView().getResolution()
	return resolution === undefined ? undefined : pickPoint(props.lines, props.places, coordinate, resolution)
}

/** Pans the map to a newly chosen point if it is outside the visible part or close to its edge. */
function reveal (point: RoutePoint | undefined): void {
	const view = map?.getView()
	const size = map?.getSize()
	const resolution = view?.getResolution()
	if (!point || !view || !size || resolution === undefined) {
		return
	}
	const visible = buffer(view.calculateExtent(size), -REVEAL_MARGIN_PIXELS * resolution)
	if (!containsCoordinate(visible, point.coordinate)) {
		view.animate({ center: point.coordinate, duration: animationDuration(500) })
	}
}

// After rendering, so that the hint that comes with the network is there to make room for.
watch(() => [props.network, props.lines, props.places], showNetwork, { flush: 'post' })

/** Zooms to the whole route, or as far as needed to show it. */
function fitRoute (): void {
	const extent = routeLayer.layer.getSource()?.getExtent()
	if (map && extent) {
		map.getView().fit(extent, { padding: fitPadding(48), maxZoom: 16, duration: animationDuration(600) })
	}
}

/**
 * Under a route, the lines are dimmed; while one line is highlighted, it is shown in full and the others
 * are washed out by the line layer itself instead.
 */
function dimLines (route: Route | undefined): void {
	lineLayer.layer.setOpacity(route && !props.highlightedLine ? DIMMED_LINE_OPACITY : 1)
}

/** Markers for start, destination and changes, and the route over the dimmed lines. */
function drawSelection (start: RoutePoint | undefined, destination: RoutePoint | undefined, route: Route | undefined): void {
	const changes = (route?.legs ?? []).slice(1).map(leg => leg.coordinates[0]).filter(coordinate => coordinate !== undefined)
	selectionLayer.showSelection(start, destination, changes)
	// A station with a pin on it changes a little, also while a pin is dragged over it and snaps.
	placeLayer.markChosen([start, destination].filter((point): point is RoutePoint => point?.kind === 'place').map(point => point.id))
	routeLayer.showRoute(route)
	dimLines(route)
}

/** How much of the chosen route and its markers shows while another line is previewed. */
const RECEDED_OPACITY = 0.4

/**
 * A line pointed at in the legend is a preview of choosing it: it comes forward, the other lines are washed
 * out, and a chosen route steps back with its markers, still recognizable. During a ride the route and the
 * vehicle stay as they are. Leaving the line restores everything; the preview never changes the choice.
 */
function showHighlight (): void {
	const lineId = props.highlightedLine
	lineLayer.highlight(lineId)
	placeLayer.highlight(lineId)
	dimLines(props.route)
	const receded = lineId !== undefined && props.route !== undefined && props.ride === undefined
	routeLayer.layer.setOpacity(receded ? RECEDED_OPACITY : 1)
	selectionLayer.layer.setOpacity(receded ? RECEDED_OPACITY : 1)
}

// Only whether a ride exists, not each of its frames.
watch(() => [props.highlightedLine, props.route, props.ride === undefined] as const, showHighlight)

/** A point just dropped after dragging it, until the selection shows it: the view then stays where the user put it. */
let dropped: RoutePoint | undefined

/**
 * Start, destination and route, and the view on what changed. The view stays where it is for a point just dropped
 * after dragging, which the user put where they wanted it, and for a swap of start and destination, which shows the
 * same route the other way round.
 */
function showSelection (previousStart?: RoutePoint, previousDestination?: RoutePoint): void {
	const droppedHere = dropped !== undefined && (props.start === dropped || props.destination === dropped)
	const swapped = (previousStart !== undefined || previousDestination !== undefined) &&
		props.start === previousDestination && props.destination === previousStart
	dropped = undefined
	drawSelection(props.start, props.destination, props.route)
	if (droppedHere || swapped) {
		return
	}
	if (props.route) {
		fitRoute()
	} else {
		reveal(props.start === previousStart ? props.destination : props.start)
	}
}

watch(() => [props.start, props.destination, props.route] as const, (_, [previousStart, previousDestination]) => {
	showSelection(previousStart, previousDestination)
})

/**
 * The start or destination being dragged, where it is now, and how far its tip is from the pointer, in pixels:
 * a pin is grabbed by its head, and the tip keeps its distance instead of jumping to the pointer.
 */
let drag: { endpoint: Endpoint, point: RoutePoint | undefined, grip: readonly [number, number] } | undefined
/** The last press was on the start or destination, so the click it makes chooses nothing. */
let grabbed = false

/** The start or destination marker under the pointer, if points can be chosen at all. */
function endpointAt (event: MapBrowserEvent): Endpoint | undefined {
	const touch = event.originalEvent instanceof PointerEvent && event.originalEvent.pointerType === 'touch'
	return map && props.picking ? selectionLayer.endpointAt(map, event.pixel, GRAB_TOLERANCE_PIXELS[touch ? 'touch' : 'mouse']) : undefined
}

/** While dragging: the marker slides along the lines, and the route follows; the form only learns of it on drop. */
function previewDrag (pixel: readonly number[]): void {
	const resolution = map?.getView().getResolution()
	const [x = 0, y = 0] = pixel
	const tip = drag && map?.getCoordinateFromPixel([x + drag.grip[0], y + drag.grip[1]])
	if (!drag || !tip || !props.network || resolution === undefined) {
		return
	}
	const point = dragPoint(props.lines, props.places, tip, resolution)
	const other = drag.endpoint === 'start' ? props.destination : props.start
	// Where the other endpoint is, the marker stops, as a choice there would be refused.
	if (!point || point.id === drag.point?.id || (other && isSamePoint(point, other))) {
		return
	}
	drag.point = point
	const [start, destination] = drag.endpoint === 'start' ? [point, other] : [other, point]
	drawSelection(start, destination, start && destination ? findRoute(props.network, props.lines, start.coordinate, destination.coordinate) : undefined)
}

function endDrag (): void {
	const finished = drag
	drag = undefined
	mapElement.value?.classList.remove('map--dragging')
	if (!finished) {
		return
	}
	const before = finished.endpoint === 'start' ? props.start : props.destination
	if (finished.point && finished.point.id !== before?.id) {
		dropped = finished.point
		emit('move', finished.endpoint, finished.point)
	} else {
		drawSelection(props.start, props.destination, props.route)
		drawRide(props.ride)
	}
}

/** Pressing on the start or destination and moving drags it along the lines, instead of moving the map. */
const markerDrag = new PointerInteraction({
	handleDownEvent: event => {
		const endpoint = endpointAt(event)
		grabbed = endpoint !== undefined
		if (!endpoint) {
			return false
		}
		const point = endpoint === 'start' ? props.start : props.destination
		const [tipX = 0, tipY = 0] = (point && map?.getPixelFromCoordinate(point.coordinate)) ?? event.pixel
		const [x = 0, y = 0] = event.pixel
		drag = { endpoint, point, grip: [tipX - x, tipY - y] }
		// After a ride, the vehicle would stay at the old destination.
		selectionLayer.showVehicle(undefined)
		mapElement.value?.classList.add('map--dragging')
		return true
	},
	handleDragEvent: event => {
		previewDrag(event.pixel)
	},
	handleUpEvent: () => {
		endDrag()
		return false
	},
})

/** With reduced motion, the view shows one leg at a time, without animation. */
function fitLeg (legIndex: number): void {
	const leg = props.route?.legs[legIndex]
	if (map && leg) {
		map.getView().fit(boundingExtent([...leg.coordinates]), { padding: fitPadding(48), maxZoom: 16 })
	}
}

/** The vehicle and the part of the route travelled. */
function drawRide (ride: RideView | undefined): void {
	const line = LINES.find(candidate => candidate.id === ride?.lineId)
	selectionLayer.showVehicle(ride && line ? { coordinate: ride.position.coordinate, line } : undefined)
	routeLayer.showTravelled(ride?.position.travelled ?? [])
}

/** The route the current ride runs on. */
let rideRoute: Route | undefined

/**
 * The vehicle and the part travelled on every frame. The view zooms to the start, then follows the vehicle;
 * with reduced motion it jumps from leg to leg instead. When the ride ends, it shows the whole route again.
 */
function showRide (ride: RideView | undefined, previous: RideView | undefined): void {
	drawRide(ride)
	const view = map?.getView()
	if (!view) {
		return
	}
	if (!ride) {
		// A ride ended by a new start or destination leaves the view to showSelection.
		if (previous && props.route === rideRoute) {
			fitRoute()
		}
		return
	}
	if (!previous) {
		rideRoute = props.route
	}
	if (ride.stepped) {
		if (previous?.state.legIndex !== ride.state.legIndex) {
			fitLeg(ride.state.legIndex)
		}
	} else if (!previous) {
		view.animate({ center: ride.position.coordinate, zoom: RIDE_ZOOM, duration: animationDuration(1200) })
	} else if (ride.status === 'running' && !view.getAnimating() && !equals(ride.position.coordinate, previous.position.coordinate)) {
		view.setCenter(ride.position.coordinate)
	}
}

watch(() => props.ride, showRide)

onMounted(() => {
	// Right after the zoom buttons, below which it is shown: OpenLayers adds the controls to the page in this order,
	// and Tab follows it (before the rotate button at the top right and the attributions at the bottom).
	const controls = createControls()
	controls.insertAt(1, createFitControl(() => {
		fitNetwork(animationDuration(600))
	}))
	map = new OlMap({
		target: mapElement.value ?? undefined,
		controls,
		// The map's own defaults pan and zoom with the mouse wheel only while the map has the focus, because it has a
		// tabindex; in an app that is all map, it should react at once. Marker dragging comes last, so it sees a
		// press before panning does.
		interactions: defaultInteractions().extend([markerDrag]),
		layers: [backgroundLayer, lineLayer.layer, routeLayer.layer, placeLayer.layer, selectionLayer.layer],
		view: new View({
			projection: MAP_PROJECTION,
			center: fromLonLat(KIEL_CENTER, MAP_PROJECTION),
			zoom: INITIAL_ZOOM,
		}),
	})
	// "singleclick" waits until a double click (zoom) is ruled out.
	map.on('singleclick', event => {
		if (props.picking && props.lines.length > 0 && !grabbed) {
			emit('pick', pointAt(event.coordinate))
		}
	})
	map.on('pointermove', event => {
		if (!event.dragging) {
			const draggable = endpointAt(event) !== undefined
			mapElement.value?.classList.toggle('map--draggable', draggable)
			mapElement.value?.classList.toggle('map--pickable', !draggable && props.picking && pointAt(event.coordinate) !== undefined)
		}
	})
	map.on('pointerdrag', () => {
		if (!drag) {
			emit('pan')
		}
	})
	showNetwork()
	showSelection(props.start)
})

onBeforeUnmount(() => {
	map?.setTarget(undefined)
	map?.dispose()
	map = undefined
})
</script>

<template>
	<div class="map-view">
		<div
			ref="mapTarget"
			class="map"
			role="region"
			aria-label="Karte des geplanten Stadtbahnnetzes in Kiel"
			aria-describedby="map-help"
			tabindex="0"
		/>
		<p
			id="map-help"
			class="kern-sr-only"
		>
			Ein Klick oder Tippen auf eine Linie wählt Start oder Ziel; mit gedrückter Maustaste oder gedrücktem Finger lassen sie sich entlang der Linien verschieben.
			Das Formular „Start und Ziel“ bietet dieselbe Auswahl per Tastatur.
			Wenn die Karte den Fokus hat, verschieben die Pfeiltasten die Karte, Plus und Minus zoomen.
		</p>
		<!-- At the top of the map: how to use it, and below that a notice when the background map cannot be loaded. -->
		<div class="map-overlay">
			<MapHint :endpoint="hint" />
			<!-- Always in the page, so that screen readers hear the message when it appears. -->
			<div
				class="map-notice"
				:class="{ 'app-visually-hidden': !basemapNotice }"
			>
				<span
					v-if="basemapNotice"
					class="kern-icon kern-icon--warning map-notice__icon"
					aria-hidden="true"
				/>
				<p
					class="map-notice__message"
					role="status"
				>
					{{ basemapNotice ? 'Die Hintergrundkarte ist nicht erreichbar.' : '' }}
				</p>
				<!-- Only the icon on narrow phones (KERN's kern-sr-only-mobile), where the notice would cover the map. -->
				<button
					v-if="basemapNotice"
					class="kern-btn kern-btn--secondary kern-btn--small map-notice__retry"
					type="button"
					@click="retryBasemap"
				>
					<span
						class="kern-icon kern-icon--autorenew"
						aria-hidden="true"
					/>
					<span class="kern-label kern-sr-only-mobile">Erneut versuchen</span>
				</button>
			</div>
		</div>
	</div>
</template>

<style scoped>
.map-view {
	/* OpenLayers control colors, taken from KERN so that they follow light and dark mode. */
	--ol-background-color: var(--kern-color-layout-background-default);
	--ol-foreground-color: var(--kern-color-layout-text-default);
	--ol-subtle-foreground-color: var(--kern-color-layout-text-muted);
	--ol-partial-background-color: var(--kern-color-layout-background-default);
	--ol-subtle-background-color: var(--kern-color-layout-background-hued);
	--ol-accent-background-color: var(--kern-color-layout-background-hued);
	--ol-brand-color: var(--kern-color-action-default);

	position: relative;
	min-height: 0;
}

.map {
	width: 100%;
	height: 100%;
}

/* At the top of the map, centered between the zoom buttons (left) and the rotate button (right), 44 px each. */
.map-overlay {
	position: absolute;
	top: var(--kern-metric-space-small);
	inset-inline: calc(2 * var(--kern-metric-space-small) + 44px);
	display: flex;
	flex-direction: column;
	gap: var(--kern-metric-space-small);
	align-items: center;
	pointer-events: none;
}

/*
 * Like the status bar of the page, with the warning color of KERN: the map works, only its background is missing.
 * One row and the size of messages (14 px), so that it covers little of the map.
 */
.map-notice {
	display: flex;
	gap: var(--kern-metric-space-small);
	align-items: center;
	max-width: 100%;
	padding: var(--kern-metric-space-x-small) var(--kern-metric-space-small);
	color: var(--kern-color-layout-text-default);
	background: var(--kern-color-feedback-warning-background);
	border: var(--kern-metric-border-width-light) solid var(--kern-color-layout-border);
	border-left: var(--kern-metric-border-width-bold) solid var(--kern-color-feedback-warning);
	border-radius: var(--kern-metric-border-radius-default);
	box-shadow: var(--kern-shadow-elevation-low);
	pointer-events: auto;
}

.map-notice__message {
	flex: 1 1 auto;
	margin: 0;
	font-size: var(--kern-font-size-14);
}

.map-notice__retry {
	flex: none;
	margin: 0;
}

/* KERN colors its icons with a token it defines only inside its layer containers. */
.map-notice__icon {
	margin: 0;
	background-color: var(--kern-color-layout-text-default);
}

/* Over a line, the pointer shows that a click chooses a point there; over start or destination, that they can be dragged. */
.map--pickable {
	cursor: pointer;
}

.map--draggable {
	cursor: grab;
}

.map--dragging {
	cursor: grabbing;
}

/*
 * Keyboard focus on the map: the OpenLayers viewport would cover an outline on the map element itself, so an
 * overlay draws it on top, inside the map. The first rule is more specific than the general one in main.css.
 */
.map-view .map[tabindex]:focus-visible {
	outline: none;
}

.map-view:has(> .map:focus-visible)::after {
	position: absolute;
	inset: 0;
	content: "";
	outline: var(--app-focus-outline);
	outline-offset: -4px;
	pointer-events: none;
}

/* Map buttons in the style of KERN secondary buttons, 44 px for comfortable touch targets. */
.map-view :deep(.ol-zoom),
.map-view :deep(.ol-rotate),
.map-view :deep(.app-fit) {
	display: flex;
	flex-direction: column;
	gap: var(--kern-metric-space-x-small);
	padding: 0;
	background: none;
}

.map-view :deep(.ol-zoom) {
	top: var(--kern-metric-space-small);
	left: var(--kern-metric-space-small);
}

.map-view :deep(.ol-rotate) {
	top: var(--kern-metric-space-small);
	right: var(--kern-metric-space-small);
}

/* Below the two zoom buttons. */
.map-view :deep(.app-fit) {
	top: calc(2 * var(--kern-metric-space-small) + 2 * 44px + var(--kern-metric-space-x-small));
	left: var(--kern-metric-space-small);
}

/* Only zoom and rotate: a broader selector would also show the attribution toggle that OpenLayers hides. */
.map-view :deep(.ol-zoom button),
.map-view :deep(.ol-rotate button),
.map-view :deep(.app-fit button) {
	display: grid;
	place-items: center;
	width: 44px;
	height: 44px;
	margin: 0;
	color: var(--kern-color-action-default);
	font-family: var(--kern-typography-font-family-default);
	font-size: 1.5rem;
	font-weight: var(--kern-typography-font-weight-semi-bold);
	line-height: 1;
	background: var(--kern-color-layout-background-default);
	border: var(--kern-metric-border-width-default) solid var(--kern-color-action-default);
	border-radius: var(--kern-metric-border-radius-default);
}

.map-view :deep(.ol-zoom button:hover),
.map-view :deep(.ol-rotate button:hover),
.map-view :deep(.app-fit button:hover) {
	color: var(--kern-color-action-on-default);
	background: var(--kern-color-action-default);
	outline: none;
}

.map-view :deep(.ol-zoom button:focus),
.map-view :deep(.ol-rotate button:focus),
.map-view :deep(.app-fit button:focus) {
	outline: none;
}

.map-view :deep(.ol-zoom button:focus-visible),
.map-view :deep(.ol-rotate button:focus-visible),
.map-view :deep(.app-fit button:focus-visible) {
	outline: var(--app-focus-outline);
	outline-offset: 2px;
}

/* Attributions on a solid background, so that their contrast does not depend on the map below. */
.map-view :deep(.ol-attribution) {
	right: 0;
	bottom: 0;
	max-width: 100%;
	padding: var(--kern-metric-space-2x-small) var(--kern-metric-space-small);
	background: var(--kern-color-layout-background-default);
	border-radius: var(--kern-metric-border-radius-default) 0 0 0;
}

.map-view :deep(.ol-attribution ul) {
	padding: 0;
	color: var(--kern-color-layout-text-default);
	font-size: var(--kern-font-size-14);
	text-shadow: none;
}

.map-view :deep(.ol-attribution a) {
	color: var(--kern-color-action-default);
}

/* Phones (portrait, or landscape with little height): the same text, smaller and closer, so it covers less map. */
@media (max-width: 47.99rem), (max-height: 37.5rem) {
	.map-view :deep(.ol-attribution) {
		padding: 0 var(--kern-metric-space-x-small);
	}

	.map-view :deep(.ol-attribution ul) {
		font-size: var(--kern-font-size-12);
		line-height: 1.4;
	}
}

/* Dark mode: the grey basemap is inverted, so the map matches KERN's dark theme. */
@media (prefers-color-scheme: dark) {
	.map-view :deep(.basemap) {
		filter: invert(1) hue-rotate(180deg) brightness(0.9) contrast(0.9);
	}
}
</style>
