<script setup lang="ts">
import type { LineDefinition } from '@/data/lines'

defineProps<{
	line: LineDefinition
}>()
</script>

<template>
	<!-- Decorative: the line name is always written next to the badge. -->
	<span
		class="line-badge"
		:style="{ '--line-color': line.color, '--line-on-color': line.onColor }"
		aria-hidden="true"
	>{{ line.id }}</span>
</template>

<style scoped>
/* The line number on a disc in the line color, as on transit signs and on the map. */
.line-badge {
	display: inline-grid;
	flex: none;
	place-items: center;
	width: 2rem;
	height: 2rem;
	color: var(--line-on-color);
	font-size: var(--kern-typography-font-size-small-static);
	font-weight: var(--kern-typography-font-weight-semi-bold);
	line-height: 1;
	background: var(--line-color);
	border-radius: 50%;

	/* Keeps the disc visible in Windows high contrast mode, where backgrounds are removed. */
	outline: 2px solid transparent;
}

@media (forced-colors: active) {
	.line-badge {
		outline-color: CanvasText;
	}
}
</style>
