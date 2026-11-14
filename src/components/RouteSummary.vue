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
	<section
		class="route-summary"
		aria-labelledby="route-summary-title"
	>
		<h2
			id="route-summary-title"
			class="route-summary__title"
		>
			Verbindung
		</h2>
		<!-- Announces every new route in one sentence; the list below shows it step by step. -->
		<p
			class="route-summary__total"
			role="status"
		>
			<template v-if="description">
				<span class="kern-sr-only">Verbindung: </span>{{ description.summary }}<span class="kern-sr-only">. {{ description.sentence }}</span>
			</template>
			<template v-else-if="complete">
				Zwischen Start und Ziel gibt es keine Verbindung.
			</template>
			<template v-else>
				Sobald Start und Ziel gewählt sind, steht hier die Verbindung.
			</template>
		</p>
		<ol
			v-if="description"
			class="route-summary__legs"
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
	</section>
</template>

<style scoped>
.route-summary {
	display: grid;
	gap: var(--kern-metric-space-small);
}

.route-summary__title {
	margin: 0;
	font-size: var(--kern-typography-font-size-medium-static);
	font-weight: var(--kern-typography-font-weight-semi-bold);
}

.route-summary__total,
.route-summary__line,
.route-summary__stretch {
	margin: 0;
}

.route-summary__total {
	font-weight: var(--kern-typography-font-weight-semi-bold);
}

.route-summary__legs {
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
