<script setup lang="ts">
import { computed, shallowRef, useTemplateRef } from 'vue'

import type { LineId } from '@/data/lines'

import LineLegend from '@/components/LineLegend.vue'
import MapView from '@/components/MapView.vue'
import RideControls from '@/components/RideControls.vue'
import RouteForm from '@/components/RouteForm.vue'
import RouteSummary from '@/components/RouteSummary.vue'
import { useNetwork } from '@/composables/useNetwork'
import { useRide } from '@/composables/useRide'
import { useRouteSelection } from '@/composables/useRouteSelection'
import { type LoadStatus, useSections } from '@/composables/useSections'
import { MAP_PROJECTION } from '@/map/config'
import { itemAt } from '@/network/graph'
import { formatDistance, lineBetween, lineEndPoints } from '@/network/routePoints'
import { describeRoute } from '@/routing/describe'
import { findRoute } from '@/routing/route'

const { sections, status: loadStatus, errorMessage: loadError, load } = useSections(MAP_PROJECTION)
const model = useNetwork(sections)
const { start, destination, clickTarget, message: selectionMessage, messageShown: selectionMessageShown, choose, chooseBoth, chooseOnMap, move, swap } = useRouteSelection()
const statusMessage = useTemplateRef<HTMLParagraphElement>('statusMessage')

const network = computed(() => model.value.state === 'ready' ? model.value.network : undefined)
const lines = computed(() => model.value.state === 'ready' ? model.value.lines : [])
const places = computed(() => model.value.state === 'ready' ? model.value.places : [])

const route = computed(() => network.value && start.value && destination.value
	? findRoute(network.value, lines.value, start.value.coordinate, destination.value.coordinate)
	: undefined)
const routeDescription = computed(() => route.value && start.value && destination.value
	? describeRoute(route.value, start.value, destination.value, lines.value, places.value)
	: undefined)

/** The line pointed at in the legend: the others are washed out on the map, unless it is the chosen line already. */
const highlightedLine = shallowRef<LineId>()

/** The line whose two ends are start and destination, marked in the legend. */
const selectedLineId = computed(() => start.value && destination.value
	? lineBetween(lines.value, start.value.coordinate, destination.value.coordinate)
	: undefined)

/** A line clicked in the legend: start and destination at its two ends, in the direction of its route. */
function chooseLine (lineId: LineId): void {
	const line = lines.value.find(candidate => candidate.definition.id === lineId)
	const ends = line && lineEndPoints(line, lines.value, places.value)
	if (ends) {
		chooseBoth(ends.start, ends.destination)
	}
}

const ride = useRide(route, routeDescription)
const { status: rideStatus, speed: rideSpeed, message: rideMessage, messageShown: rideMessageShown, view: rideView, progress: rideProgress } = ride

/** A ride is going on (not yet arrived): on small screens, the side panel shows only the ride. */
const riding = computed(() => rideStatus.value === 'running' || rideStatus.value === 'paused')

/** Dragging the map during a ride pauses it, so that the view does not jump back to the vehicle while the user looks around. */
function onMapPan (): void {
	ride.pause('die Karte verschoben wurde')
}

/** Loading the WFS and laying the lines onto it both have to succeed. */
const status = computed<LoadStatus>(() => model.value.state === 'error' ? 'error' : loadStatus.value)

const statusText = computed(() => {
	if (model.value.state === 'error') {
		return `Die Linien konnten nicht auf die Streckenabschnitte gelegt werden. ${model.value.message}`
	}
	switch (loadStatus.value) {
		case 'loading':
			return 'Das Stadtbahnnetz wird geladen …'
		case 'error':
			return `Das Stadtbahnnetz konnte nicht geladen werden. ${loadError.value}`
		case 'ready': {
			if (model.value.state !== 'ready') {
				return ''
			}
			// Track used by the lines, each shared stretch counted once (the depot track is not part of a line).
			const { network: graph, lines: resolved, places } = model.value
			const edgeIds = new Set(resolved.flatMap(line => line.path.edgeIds))
			const meters = [...edgeIds].reduce((sum, edgeId) => sum + itemAt(graph.edges, edgeId).lengthMeters, 0)
			return `Stadtbahnnetz geladen: ${String(resolved.length)} Linien auf ${formatDistance(meters)} Strecke, ${String(places.length)} benannte Orte.`
		}
	}
})

/** The button disappears while loading, so focus moves to the status message instead of getting lost. */
function retry (): void {
	load()
	statusMessage.value?.focus()
}
</script>

<template>
	<header class="app-header">
		<div class="app-header__brand">
			<svg
				class="app-logo"
				viewBox="0 0 32 32"
				width="32"
				height="32"
				aria-hidden="true"
				focusable="false"
			>
				<rect
					class="app-logo__plate"
					width="32"
					height="32"
					rx="6"
				/>
				<path
					class="app-logo__route"
					d="M8 23 L14 15 L19 18 L24 9"
				/>
				<circle
					class="app-logo__start"
					cx="8"
					cy="23"
					r="3.5"
				/>
				<circle
					class="app-logo__destination"
					cx="24"
					cy="9"
					r="3.5"
				/>
			</svg>
			<h1 class="app-header__title">
				Stadtbahn-Simulator Kiel
			</h1>
		</div>
		<p class="app-header__note">
			Studentisches Projekt, kein offizielles Angebot der Landeshauptstadt Kiel.
		</p>
	</header>
	<main class="app-main">
		<!-- Only while loading or after an error; once the network is loaded, the message is left for screen readers. -->
		<div
			class="status-bar"
			:class="[`status-bar--${status}`, { 'app-visually-hidden': status === 'ready' }]"
		>
			<span
				v-if="status === 'loading'"
				class="kern-loader kern-loader--visible status-bar__loader"
				aria-hidden="true"
			/>
			<span
				v-else-if="status === 'error'"
				class="kern-icon kern-icon--danger status-bar__icon"
				aria-hidden="true"
			/>
			<p
				ref="statusMessage"
				class="status-bar__message"
				role="status"
				tabindex="-1"
			>
				{{ statusText }}
			</p>
			<button
				v-if="status === 'error'"
				class="kern-btn kern-btn--secondary kern-btn--small"
				type="button"
				@click="retry"
			>
				<span
					class="kern-icon kern-icon--autorenew"
					aria-hidden="true"
				/>
				<span class="kern-label">Erneut versuchen</span>
			</button>
		</div>
		<div class="app-content">
			<MapView
				:network="network"
				:lines="lines"
				:places="places"
				:start="start"
				:destination="destination"
				:route="route"
				:ride="rideView"
				:picking="rideStatus === 'idle' || rideStatus === 'arrived'"
				:highlighted-line="highlightedLine === selectedLineId ? undefined : highlightedLine"
				@pick="chooseOnMap"
				@move="move"
				@pan="onMapPan"
			/>
			<!-- Focusable, because on small screens the panel scrolls and must be scrollable by keyboard. -->
			<aside
				class="side-panel"
				:class="{ 'side-panel--riding': riding }"
				aria-label="Verbindung und Linien"
				tabindex="0"
			>
				<RouteForm
					v-model:click-target="clickTarget"
					:places="places"
					:start="start"
					:destination="destination"
					:message="selectionMessage"
					:message-shown="selectionMessageShown"
					@choose="choose"
					@swap="swap"
				/>
				<RouteSummary
					:description="routeDescription"
					:complete="start !== undefined && destination !== undefined"
					:current-leg="rideView?.state.legIndex"
				/>
				<RideControls
					v-if="route"
					v-model:speed="rideSpeed"
					:status="rideStatus"
					:progress="rideProgress"
					:length-meters="route.lengthMeters"
					:message="rideMessage"
					:message-shown="rideMessageShown"
					@start="ride.start"
					@pause="ride.pause()"
					@resume="ride.resume"
					@stop="ride.stop('Fahrt beendet.')"
				/>
				<LineLegend
					:lines="lines"
					:selected-line-id="selectedLineId"
					@highlight="highlightedLine = $event"
					@choose="chooseLine"
				/>
			</aside>
		</div>
	</main>
</template>

<style scoped>
.app-header {
	display: flex;
	flex-wrap: wrap;
	gap: var(--kern-metric-space-x-small) var(--kern-metric-space-default);
	justify-content: space-between;
	align-items: center;
	padding: var(--kern-metric-space-small) var(--kern-metric-space-default);
	border-bottom: var(--kern-metric-border-width-bold) solid var(--app-color-signal);
}

.app-header__brand {
	display: flex;
	gap: var(--kern-metric-space-small);
	align-items: center;
}

.app-header__title {
	margin: 0;
	font-size: var(--kern-typography-font-size-large-static);
	font-weight: var(--kern-typography-font-weight-semi-bold);
	line-height: 1.2;
}

.app-header__note {
	margin: 0;
	color: var(--kern-color-layout-text-muted);
	font-size: var(--kern-font-size-14);
}

/* Logo: a route between two points on a signal-yellow plate, in the style of a transit sign. */
.app-logo {
	flex: none;
}

.app-logo__plate {
	fill: var(--app-color-signal);
}

.app-logo__route {
	fill: none;
	stroke: var(--app-color-on-signal);
	stroke-width: 3;
	stroke-linecap: round;
	stroke-linejoin: round;
}

.app-logo__start {
	fill: var(--app-color-on-signal);
}

.app-logo__destination {
	fill: var(--app-color-signal);
	stroke: var(--app-color-on-signal);
	stroke-width: 2.5;
}

.app-main {
	display: grid;
	grid-template-rows: auto 1fr;
	min-height: 0;
}

.status-bar {
	display: flex;
	flex-wrap: wrap;
	gap: var(--kern-metric-space-small) var(--kern-metric-space-default);
	align-items: center;
	min-height: 44px;
	padding: var(--kern-metric-space-x-small) var(--kern-metric-space-default);
	background: var(--kern-color-layout-background-hued);
	border-bottom: var(--kern-metric-border-width-light) solid var(--kern-color-layout-border);
}

/* Hidden once the network is loaded (with app-visually-hidden); its own size would keep it 44 px high. */
.status-bar--ready {
	min-height: 0;
	padding: 0;
	border: 0;
}

.status-bar__message {
	flex: 1 1 16rem;
	margin: 0;
}

.status-bar__loader {
	width: 1.25rem;
	height: 1.25rem;
	border-width: 3px;
}

.status-bar__icon {
	margin: 0;
}

/* Map and side panel: side by side on laptops and phones in landscape, the panel below the map in portrait. */
.app-content {
	/* Row 2 also when the status bar is hidden and takes no row. */
	grid-row: 2;
	display: grid;
	grid-template-rows: minmax(0, 1fr) auto;
	min-height: 0;
}

/*
 * The scrollbar is always there where the system shows one (Windows), even with nothing to scroll: one that
 * comes and goes, for example when the line list is closed, moves the whole panel sideways. In KERN's colors,
 * so that it fits the light and the dark theme.
 */
.side-panel {
	display: grid;
	gap: var(--kern-metric-space-large);
	align-content: start;
	max-height: 40dvh;
	overflow-y: scroll;
	scrollbar-color: var(--kern-color-layout-border) var(--kern-color-layout-background-hued);
	padding: var(--kern-metric-space-default);
	background: var(--kern-color-layout-background-default);
	border-top: var(--kern-metric-border-width-light) solid var(--kern-color-layout-border);
}

/* Inside the panel, so that the outline does not cover the map. More specific than the general rule in main.css. */
.app-content .side-panel[tabindex]:focus-visible {
	outline-offset: -4px;
}

@media (min-width: 48rem), (orientation: landscape) and (min-width: 36rem) {
	.app-content {
		grid-template-rows: minmax(0, 1fr);
		/* At least 18rem on a phone in landscape; 26rem on laptops, see below. */
		grid-template-columns: minmax(0, 1fr) clamp(18rem, 34vw, 26rem);
	}

	.side-panel {
		max-height: none;
		border-top: none;
		border-left: var(--kern-metric-border-width-light) solid var(--kern-color-layout-border);
	}
}

/*
 * Every laptop gets the full width, small ones too (34vw would be 22rem at 1024 px): "Fahrt starten" and the
 * speed then fit in one row, even next to a Windows scrollbar (17 px).
 */
@media (min-width: 64rem) {
	.app-content {
		grid-template-columns: minmax(0, 1fr) 26rem;
	}
}

/*
 * During a ride on a phone (portrait, or landscape with little height), the panel shows only the leg the
 * vehicle is on and the ride controls, so the map keeps most of the screen. Everything comes back
 * when the ride is stopped or arrives.
 */
@media (max-width: 47.99rem), (max-height: 37.5rem) {
	.side-panel--riding .route-form,
	.side-panel--riding .line-legend,
	.side-panel--riding :deep(.route-summary__leg:not([aria-current])) {
		display: none;
	}
}

/* Little height (a phone in landscape): a narrower header leaves more of it to the map. */
@media (max-height: 37.5rem) {
	.app-header {
		padding-block: var(--kern-metric-space-x-small);
	}

	.app-header__title {
		font-size: var(--kern-typography-font-size-medium-static);
	}
}

.status-bar--error {
	background: var(--kern-color-feedback-danger-background);
	border-left: var(--kern-metric-border-width-bold) solid var(--kern-color-feedback-danger);
}
</style>
