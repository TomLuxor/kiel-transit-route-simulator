<script setup lang="ts">
import type { RouteDescription } from '@/routing/describe'

import LineBadge from './LineBadge.vue'

defineProps<{
	description: RouteDescription | undefined
	/** Start and destination are both chosen. */
	complete: boolean
	/** The leg the vehicle is on during a ride. */
	currentLeg?: number | undefined
}>()
</script>

<template>
	<!--
		Announces every new route in one sentence; the list below shows it step by step. Only seen if there is
		no route between start and destination. Before that, the panel shows nothing here.
	-->
	<p
		class="route-summary__status"
		:class="{ 'app-visually-hidden': description || !complete }"
		role="status"
	>
		<template v-if="description">
			Verbindung: {{ description.summary }}. {{ description.sentence }}
		</template>
		<template v-else-if="complete">
			Zwischen Start und Ziel gibt es keine Verbindung.
		</template>
	</p>
	<ol
		v-if="description"
		class="route-summary"
		aria-label="Verbindung"
	>
		<li
			v-for="(leg, index) in description.legs"
			:key="index"
			class="route-summary__leg"
			:aria-current="index === currentLeg ? 'step' : undefined"
		>
			<LineBadge :line="leg.line" />
			<div>
				<p class="route-summary__line">
					{{ index === 0 ? leg.line.name : `Umstieg in ${leg.line.name}` }}
					<span class="route-summary__distance">{{ leg.distance }}</span>
				</p>
				<p class="route-summary__stretch">
					{{ leg.from }} {{ leg.to }}
				</p>
			</div>
		</li>
	</ol>
</template>

<style scoped>
.route-summary__status,
.route-summary__line,
.route-summary__stretch {
	margin: 0;
}

.route-summary {
	display: grid;
	gap: var(--kern-metric-space-default);
	margin: 0;
	padding: 0;
	list-style: none;
}

.route-summary__leg {
	display: flex;
	gap: var(--kern-metric-space-small);
	align-items: flex-start;
}

/* During a ride, the leg the vehicle is on. */
.route-summary__leg[aria-current="step"] {
	margin: calc(-1 * var(--kern-metric-space-x-small)) calc(-1 * var(--kern-metric-space-small));
	padding: var(--kern-metric-space-x-small) var(--kern-metric-space-small);
	background: var(--kern-color-layout-background-hued);
	border-radius: var(--kern-metric-border-radius-default);
	outline: 2px solid transparent;
}

.route-summary__line {
	font-weight: var(--kern-typography-font-weight-semi-bold);
}

.route-summary__distance {
	margin-left: var(--kern-metric-space-x-small);
	color: var(--kern-color-layout-text-muted);
	font-weight: var(--kern-typography-font-weight-regular);
}

.route-summary__stretch {
	font-size: var(--kern-font-size-14);
}
</style>
