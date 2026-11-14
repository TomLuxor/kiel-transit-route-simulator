<script setup lang="ts">
import 'ol/ol.css'
import Feature from 'ol/Feature'
import OlMap from 'ol/Map'
import { fromLonLat } from 'ol/proj'
import VectorSource from 'ol/source/Vector'
import View from 'ol/View'
import { onBeforeUnmount, onMounted, useTemplateRef, watch } from 'vue'

import type { Section } from '@/network/sections'

import { INITIAL_ZOOM, KIEL_CENTER, MAP_PROJECTION, SECTIONS_ATTRIBUTION } from '@/map/config'
import { createBackgroundLayer, createSectionLayer } from '@/map/layers'

const props = defineProps<{
	sections: readonly Section[]
}>()

// The ref key must differ from every script variable (here `map`), or Vue cannot set it.
const mapElement = useTemplateRef<HTMLDivElement>('mapTarget')
// Vector sources cannot set attributionsCollapsible; the background source already keeps the attributions expanded.
const sectionSource = new VectorSource({ attributions: SECTIONS_ATTRIBUTION })
let map: OlMap | undefined

function showSections (sections: readonly Section[]): void {
	sectionSource.clear()
	sectionSource.addFeatures(sections.map(section => {
		const feature = new Feature({
			geometry: section.geometry,
			label: `${section.name} · ${String(section.id)}`,
		})
		feature.setId(section.id)
		return feature
	}))
	const extent = sectionSource.getExtent()
	if (map && extent && sections.length > 0) {
		map.getView().fit(extent, { padding: [32, 32, 32, 32] })
	}
}

watch(() => props.sections, showSections)

onMounted(() => {
	map = new OlMap({
		target: mapElement.value ?? undefined,
		layers: [createBackgroundLayer(), createSectionLayer(sectionSource)],
		view: new View({
			projection: MAP_PROJECTION,
			center: fromLonLat(KIEL_CENTER, MAP_PROJECTION),
			zoom: INITIAL_ZOOM,
		}),
	})
	showSections(props.sections)
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
			class="visually-hidden"
		>
			When the map has focus, the arrow keys move the map and the plus and minus keys zoom.
		</p>
	</div>
</template>

<style scoped>
.map-view {
	position: relative;
	min-height: 0;
}

.map {
	width: 100%;
	height: 100%;
}

.map:focus-visible {
	outline: 3px solid var(--color-focus);
	outline-offset: -3px;
}
</style>
