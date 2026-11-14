<script setup lang="ts">
import { computed } from 'vue'

import MapView from '@/components/MapView.vue'
import { useSections } from '@/composables/useSections'
import { MAP_PROJECTION } from '@/map/config'

const { sections, status, errorMessage, load } = useSections(MAP_PROJECTION)

const statusText = computed(() => {
	switch (status.value) {
		case 'loading':
			return 'Loading the Stadtbahn network…'
		case 'error':
			return `The Stadtbahn network could not be loaded. ${errorMessage.value}`
		case 'ready': {
			const kilometers = sections.value.reduce((sum, section) => sum + section.lengthMeters, 0) / 1000
			return `Stadtbahn network loaded: ${String(sections.value.length)} route sections, ${kilometers.toFixed(1)} km.`
		}
	}
})
</script>

<template>
	<header class="app-header">
		<h1>Kiel Transit Route Simulator</h1>
	</header>
	<main class="app-main">
		<div
			class="status-bar"
			:class="{ 'status-bar--error': status === 'error' }"
		>
			<p role="status">
				{{ statusText }}
			</p>
			<button
				v-if="status === 'error'"
				type="button"
				@click="load"
			>
				Try again
			</button>
		</div>
		<MapView :sections="sections" />
	</main>
</template>

<style scoped>
.app-header {
	padding: 0.5rem 1rem;
	border-bottom: 1px solid #c9ced4;
}

.app-header h1 {
	margin: 0;
	font-size: 1.25rem;
}

.app-main {
	display: grid;
	grid-template-rows: auto 1fr;
	min-height: 0;
}

.status-bar {
	display: flex;
	flex-wrap: wrap;
	gap: 0.5rem 1rem;
	align-items: center;
	padding: 0.25rem 1rem;
	background: var(--color-muted-background);
}

.status-bar p {
	margin: 0;
}

.status-bar--error {
	color: var(--color-error);
}
</style>
