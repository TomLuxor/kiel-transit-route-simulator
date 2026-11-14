<script setup lang="ts">
import 'ol/ol.css'
import OlMap from 'ol/Map'
import { fromLonLat } from 'ol/proj'
import View from 'ol/View'
import { onBeforeUnmount, onMounted, useTemplateRef, watch } from 'vue'

import type { Network } from '@/network/graph'
import type { ResolvedLine } from '@/network/lines'

import { INITIAL_ZOOM, KIEL_CENTER, MAP_PROJECTION } from '@/map/config'
import { createControls } from '@/map/controls'
import { createBackgroundLayer } from '@/map/layers'
import { createLineLayer } from '@/map/lineLayer'

const props = defineProps<{
	network: Network | undefined
	lines: readonly ResolvedLine[]
}>()

// The ref key must differ from every script variable (here `map`), or Vue cannot set it.
const mapElement = useTemplateRef<HTMLDivElement>('mapTarget')
const lineLayer = createLineLayer()
let map: OlMap | undefined

function showLines (): void {
	if (!props.network || props.lines.length === 0) {
		return
	}
	lineLayer.showLines(props.network, props.lines)
	const extent = lineLayer.layer.getSource()?.getExtent()
	if (map && extent) {
		map.getView().fit(extent, { padding: [32, 32, 32, 32] })
	}
}

watch(() => [props.network, props.lines], showLines)

onMounted(() => {
	map = new OlMap({
		target: mapElement.value ?? undefined,
		controls: createControls(),
		layers: [createBackgroundLayer(), lineLayer.layer],
		view: new View({
			projection: MAP_PROJECTION,
			center: fromLonLat(KIEL_CENTER, MAP_PROJECTION),
			zoom: INITIAL_ZOOM,
		}),
	})
	showLines()
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
			aria-label="Map of the planned Stadtbahn network in Kiel"
			aria-describedby="map-help"
			tabindex="0"
		/>
		<p
			id="map-help"
			class="kern-sr-only"
		>
			When the map has focus, the arrow keys move the map and the plus and minus keys zoom.
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

.map:focus-visible {
	outline: var(--app-focus-outline);
	outline-offset: -4px;
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
