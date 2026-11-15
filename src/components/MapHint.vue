<script setup lang="ts">
import { type Endpoint, ENDPOINT_WORDS } from '@/composables/useRouteSelection'

import PinIcon from './PinIcon.vue'

defineProps<{
	/** The endpoint the next click on the map sets; undefined once start and destination are both set. */
	endpoint: Endpoint | undefined
}>()
</script>

<template>
	<!--
		How to use the app, at the place and the moment it is needed: on the map, step by step, gone once start
		and destination are set. Clicks go through it to the map. "Klicke" with a mouse, "Tippe" on a touch screen.
	-->
	<Transition name="map-hint">
		<p
			v-if="endpoint"
			class="map-hint"
		>
			<PinIcon :endpoint="endpoint" />
			<span class="map-hint__mouse">Klicke auf eine Linie, um {{ ENDPOINT_WORDS[endpoint].accusative }} zu setzen.</span>
			<span class="map-hint__touch">Tippe auf eine Linie, um {{ ENDPOINT_WORDS[endpoint].accusative }} zu setzen.</span>
		</p>
	</Transition>
</template>

<style scoped>
/* In the overlay at the top of the map (MapView.vue), which places and centers it. */
.map-hint {
	display: flex;
	gap: var(--kern-metric-space-small);
	align-items: center;
	max-width: 100%;
	margin: 0;
	padding: var(--kern-metric-space-x-small) var(--kern-metric-space-small);
	color: var(--kern-color-layout-text-default);
	font-size: var(--kern-typography-font-size-small-static);
	background: var(--kern-color-layout-background-default);
	border: var(--kern-metric-border-width-light) solid var(--kern-color-layout-border);
	border-radius: var(--kern-metric-border-radius-default);
	box-shadow: var(--kern-shadow-elevation-low);
	pointer-events: none;
}

.map-hint__touch {
	display: none;
}

@media (pointer: coarse) {
	.map-hint__mouse {
		display: none;
	}

	.map-hint__touch {
		display: inline;
	}
}

/* It fades in from above when it appears and out when it goes; at once with reduced motion. */
.map-hint-enter-active,
.map-hint-leave-active {
	transition: opacity 200ms ease, translate 200ms ease;
}

.map-hint-enter-from,
.map-hint-leave-to {
	opacity: 0;
	translate: 0 calc(-1 * var(--kern-metric-space-small));
}

@media (prefers-reduced-motion: reduce) {
	.map-hint-enter-active,
	.map-hint-leave-active {
		transition: none;
	}
}
</style>
