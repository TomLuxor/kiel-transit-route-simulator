<script setup lang="ts">
import type { ResolvedLine } from '@/network/lines'

import LineBadge from './LineBadge.vue'

defineProps<{
	lines: readonly ResolvedLine[]
}>()
</script>

<template>
	<section
		class="line-legend"
		aria-labelledby="line-legend-title"
	>
		<h2
			id="line-legend-title"
			class="line-legend__title"
		>
			Lines
		</h2>
		<ul class="line-legend__list">
			<li
				v-for="line in lines"
				:key="line.definition.id"
				class="line-legend__item"
			>
				<LineBadge :line="line.definition" />
				<div>
					<p class="line-legend__name">
						{{ line.definition.name }}
						<span class="line-legend__length">{{ line.definition.officialLengthKm.toLocaleString('en') }} km</span>
					</p>
					<p class="line-legend__route">
						{{ line.definition.route }}
					</p>
				</div>
			</li>
		</ul>
		<p class="line-legend__source">
			Planned core network from the route study of the City of Kiel (2022). Where lines share a track, they are drawn side by side.
		</p>
	</section>
</template>

<style scoped>
.line-legend__title {
	margin: 0 0 var(--kern-metric-space-small);
	font-size: var(--kern-typography-font-size-medium-static);
	font-weight: var(--kern-typography-font-weight-semi-bold);
}

.line-legend__list {
	display: grid;
	gap: var(--kern-metric-space-default);
	margin: 0;
	padding: 0;
	list-style: none;
}

.line-legend__item {
	display: flex;
	gap: var(--kern-metric-space-small);
	align-items: flex-start;
}

.line-legend__name,
.line-legend__route,
.line-legend__source {
	margin: 0;
}

.line-legend__name {
	font-weight: var(--kern-typography-font-weight-semi-bold);
}

.line-legend__length {
	margin-left: var(--kern-metric-space-x-small);
	color: var(--kern-color-layout-text-muted);
	font-weight: var(--kern-typography-font-weight-regular);
}

.line-legend__route {
	font-size: var(--kern-font-size-14);
}

.line-legend__source {
	margin-top: var(--kern-metric-space-default);
	color: var(--kern-color-layout-text-muted);
	font-size: var(--kern-font-size-14);
}
</style>
