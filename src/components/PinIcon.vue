<script setup lang="ts">
import type { Endpoint } from '@/composables/useRouteSelection'

import { PIN } from '@/map/pin'

defineProps<{
	endpoint: Endpoint
}>()
</script>

<template>
	<!--
		The start or destination pin as on the map, cut to the pin and its outline. Decoration: the text beside it
		always names the endpoint.
	-->
	<svg
		class="pin-icon"
		viewBox="2 2 32 46"
		width="16"
		height="23"
		aria-hidden="true"
		focusable="false"
	>
		<path
			class="pin-icon__outline"
			:d="PIN.path"
		/>
		<path
			:class="`pin-icon__${endpoint}`"
			:d="PIN.path"
		/>
		<circle
			:class="`pin-icon__${endpoint}-dot`"
			:cx="PIN.dot.x"
			:cy="PIN.dot.y"
			:r="PIN.dot.radius"
		/>
	</svg>
</template>

<style scoped>
.pin-icon {
	flex: none;
	width: auto;
	height: 1.5rem;
}

/* The same colors as the pins on the map (src/map/selectionLayer.ts). */
.pin-icon__outline {
	fill: var(--kern-color-white);
	stroke: var(--kern-color-white);
	stroke-width: 5;
	stroke-linejoin: round;
}

.pin-icon__start {
	fill: var(--app-color-on-signal);
}

.pin-icon__start-dot {
	fill: var(--kern-color-white);
}

.pin-icon__destination {
	fill: var(--app-color-signal);
	stroke: var(--app-color-on-signal);
	stroke-width: 2.5;
	stroke-linejoin: round;
}

.pin-icon__destination-dot {
	fill: var(--app-color-on-signal);
}
</style>
