<script setup lang="ts">
import type { Coordinate } from 'ol/coordinate'

import 'ol/ol.css'
import { equals } from 'ol/coordinate'
import { boundingExtent, buffer, containsCoordinate } from 'ol/extent'
import OlMap from 'ol/Map'
import { fromLonLat } from 'ol/proj'
import View from 'ol/View'
import { onBeforeUnmount, onMounted, useTemplateRef, watch } from 'vue'

import type { RideView } from '@/composables/useRide'
import type { Network } from '@/network/graph'
import type { ResolvedLine } from '@/network/lines'
import type { ResolvedPlace } from '@/network/places'
import type { Route } from '@/routing/route'

import { LINES } from '@/data/lines'
import { INITIAL_ZOOM, KIEL_CENTER, MAP_PROJECTION } from '@/map/config'
import { createControls } from '@/map/controls'
import { createBackgroundLayer } from '@/map/layers'
import { createLineLayer } from '@/map/lineLayer'
import { animationDuration } from '@/map/motion'
import { createPlaceLayer } from '@/map/placeLayer'
import { createRouteLayer, DIMMED_LINE_OPACITY } from '@/map/routeLayer'
import { createSelectionLayer } from '@/map/selectionLayer'
import { pickPoint, type RoutePoint } from '@/network/routePoints'

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
}>()

const emit = defineEmits<{
	/** A click on the map: the chosen point, or undefined if the click was too far from every line. */
	pick: [point: RoutePoint | undefined]
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

// The ref key must differ from every script variable (here `map`), or Vue cannot set it.
const mapElement = useTemplateRef<HTMLDivElement>('mapTarget')
const lineLayer = createLineLayer()
const routeLayer = createRouteLayer()
const placeLayer = createPlaceLayer()
const selectionLayer = createSelectionLayer()
let map: OlMap | undefined

/** Padding for fitting the view, in pixels; the attributions cover the bottom of the map, more so on phones. */
function fitPadding (pixels: number): number[] {
	const attribution = mapElement.value?.querySelector<HTMLElement>('.ol-attribution')
	return [pixels, pixels, pixels + (attribution?.offsetHeight ?? 0), pixels]
}

function showNetwork (): void {
	if (!props.network || props.lines.length === 0) {
		return
	}
	lineLayer.showLines(props.network, props.lines)
	placeLayer.showPlaces(props.places, props.lines)
	const extent = lineLayer.layer.getSource()?.getExtent()
	if (map && extent) {
		map.getView().fit(extent, { padding: fitPadding(32) })
	}
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

watch(() => [props.network, props.lines, props.places], showNetwork)

/** Zooms to the whole route, or as far as needed to show it. */
function fitRoute (): void {
	const extent = routeLayer.layer.getSource()?.getExtent()
	if (map && extent) {
		map.getView().fit(extent, { padding: fitPadding(48), maxZoom: 16, duration: animationDuration(600) })
	}
}

/** Start, destination and route: markers, the route over the dimmed lines, and the view on what changed. */
function showSelection (previousStart?: RoutePoint): void {
	const changes = (props.route?.legs ?? []).slice(1).map(leg => leg.coordinates[0]).filter(coordinate => coordinate !== undefined)
	selectionLayer.showSelection(props.start, props.destination, changes)
	routeLayer.showRoute(props.route)
	lineLayer.layer.setOpacity(props.route ? DIMMED_LINE_OPACITY : 1)
	if (props.route) {
		fitRoute()
	} else {
		reveal(props.start === previousStart ? props.destination : props.start)
	}
}

watch(() => [props.start, props.destination, props.route] as const, (_, [previousStart]) => {
	showSelection(previousStart)
})

/** With reduced motion, the view shows one leg at a time, without animation. */
function fitLeg (legIndex: number): void {
	const leg = props.route?.legs[legIndex]
	if (map && leg) {
		map.getView().fit(boundingExtent([...leg.coordinates]), { padding: fitPadding(48), maxZoom: 16 })
	}
}

/**
 * The vehicle and the part travelled on every frame. The view zooms to the start, then follows the vehicle;
 * with reduced motion it jumps from leg to leg instead. When the ride ends, it shows the whole route again.
 */
function showRide (ride: RideView | undefined, previous: RideView | undefined): void {
	const line = LINES.find(candidate => candidate.id === ride?.lineId)
	selectionLayer.showVehicle(ride && line ? { coordinate: ride.position.coordinate, line } : undefined)
	routeLayer.showTravelled(ride?.position.travelled ?? [])
	const view = map?.getView()
	if (!view) {
		return
	}
	if (!ride) {
		if (previous) {
			fitRoute()
		}
		return
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
	map = new OlMap({
		target: mapElement.value ?? undefined,
		controls: createControls(),
		layers: [createBackgroundLayer(), lineLayer.layer, routeLayer.layer, placeLayer.layer, selectionLayer.layer],
		view: new View({
			projection: MAP_PROJECTION,
			center: fromLonLat(KIEL_CENTER, MAP_PROJECTION),
			zoom: INITIAL_ZOOM,
		}),
	})
	// "singleclick" waits until a double click (zoom) is ruled out.
	map.on('singleclick', event => {
		if (props.picking && props.lines.length > 0) {
			emit('pick', pointAt(event.coordinate))
		}
	})
	map.on('pointermove', event => {
		if (!event.dragging) {
			mapElement.value?.classList.toggle('map--pickable', props.picking && pointAt(event.coordinate) !== undefined)
		}
	})
	map.on('pointerdrag', () => {
		emit('pan')
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
			Ein Klick oder Tippen auf eine Linie wählt Start oder Ziel; das Formular „Start und Ziel“ bietet dieselbe Auswahl per Tastatur.
			Wenn die Karte den Fokus hat, verschieben die Pfeiltasten die Karte, Plus und Minus zoomen.
		</p>
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

/* Over a line, the pointer shows that a click chooses a point there. */
.map--pickable {
	cursor: pointer;
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
.map-view :deep(.ol-rotate) {
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

/* Only zoom and rotate: a broader selector would also show the attribution toggle that OpenLayers hides. */
.map-view :deep(.ol-zoom button),
.map-view :deep(.ol-rotate button) {
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
.map-view :deep(.ol-rotate button:hover) {
	color: var(--kern-color-action-on-default);
	background: var(--kern-color-action-default);
	outline: none;
}

.map-view :deep(.ol-zoom button:focus),
.map-view :deep(.ol-rotate button:focus) {
	outline: none;
}

.map-view :deep(.ol-zoom button:focus-visible),
.map-view :deep(.ol-rotate button:focus-visible) {
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

/* Dark mode: the grey basemap is inverted, so the map matches KERN's dark theme. */
@media (prefers-color-scheme: dark) {
	.map-view :deep(.basemap) {
		filter: invert(1) hue-rotate(180deg) brightness(0.9) contrast(0.9);
	}
}
</style>
