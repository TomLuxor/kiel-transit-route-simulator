<script setup lang="ts">
import type { LineId } from '@/data/lines'
import type { ResolvedLine } from '@/network/lines'

import LineBadge from './LineBadge.vue'

defineProps<{
	lines: readonly ResolvedLine[]
	/** The line whose two ends are start and destination. */
	selectedLineId: LineId | undefined
}>()

const emit = defineEmits<{
	/** A line pointed at or focused with the keyboard, to stand out on the map; undefined when it is left. */
	highlight: [lineId: LineId | undefined]
	/** A line clicked: ride it from end to end. */
	choose: [lineId: LineId]
}>()

/** With a finger there is no hover: a tap chooses the line, and nothing would end the highlight. */
function onPointerEnter (event: PointerEvent, lineId: LineId): void {
	if (event.pointerType !== 'touch') {
		emit('highlight', lineId)
	}
}

/** Only keyboard focus, not the focus a click or tap leaves behind. */
function onFocus (event: FocusEvent, lineId: LineId): void {
	if (event.target instanceof HTMLElement && event.target.matches(':focus-visible')) {
		emit('highlight', lineId)
	}
}
</script>

<template>
	<!-- KERN's accordion: a native disclosure, open at first, that works by mouse, touch and keyboard without script. -->
	<details
		class="kern-accordion line-legend"
		open
	>
		<summary class="kern-accordion__header">
			<h2 class="kern-title kern-title--small">
				Linien
			</h2>
		</summary>
		<div class="kern-accordion__body">
			<p
				id="line-legend-hint"
				class="line-legend__hint"
			>
				Eine Linie wählen, um sie von Ende zu Ende zu fahren.
			</p>
			<ul class="line-legend__list">
				<li
					v-for="line in lines"
					:key="line.definition.id"
				>
					<button
						class="line-legend__line"
						type="button"
						:aria-current="line.definition.id === selectedLineId ? 'true' : undefined"
						aria-describedby="line-legend-hint"
						@click="emit('choose', line.definition.id)"
						@pointerenter="onPointerEnter($event, line.definition.id)"
						@pointerleave="emit('highlight', undefined)"
						@focus="onFocus($event, line.definition.id)"
						@blur="emit('highlight', undefined)"
					>
						<LineBadge :line="line.definition" />
						<span class="line-legend__text">
							<span class="line-legend__name">
								{{ line.definition.name }}
								<span class="line-legend__length">{{ line.definition.officialLengthKm.toLocaleString('de-DE') }} km</span>
							</span>
							<span class="line-legend__route">{{ line.definition.route }}</span>
						</span>
					</button>
				</li>
			</ul>
			<p class="line-legend__source">
				Geplantes Kernnetz aus der Trassenstudie der Landeshauptstadt Kiel (2022). Wo sich Linien eine Strecke teilen, sind sie nebeneinander gezeichnet.
			</p>
		</div>
	</details>
</template>

<style scoped>
/* The accordion spans the panel; its header and body keep KERN's small inset. */
.line-legend {
	margin: 0 calc(-1 * var(--kern-metric-space-x-small));
}

.line-legend__hint,
.line-legend__source {
	margin: 0;
	color: var(--kern-color-layout-text-muted);
	font-size: var(--kern-font-size-14);
}

.line-legend__list {
	display: grid;
	gap: var(--kern-metric-space-2x-small);
	margin: var(--kern-metric-space-small) 0;
	padding: 0;
	list-style: none;
}

/* Each line is a button across the panel: hover and focus show it alone on the map, a click rides it. */
.line-legend__line {
	display: flex;
	gap: var(--kern-metric-space-small);
	align-items: flex-start;
	width: 100%;
	margin: 0;
	padding: var(--kern-metric-space-x-small) var(--kern-metric-space-small);
	color: var(--kern-color-layout-text-default);
	font: inherit;
	text-align: left;
	background: none;
	border: 0;
	border-radius: var(--kern-metric-border-radius-default);
	cursor: pointer;

	/* Shows the selected line in Windows high contrast mode, where backgrounds are removed. */
	outline: 2px solid transparent;
	outline-offset: -2px;
}

.line-legend__line:hover {
	background: var(--kern-color-action-state-indicator-tint-hover-opacity);
}

.line-legend__line:focus-visible {
	outline: var(--app-focus-outline);
	outline-offset: 2px;
}

/* The line that is start to destination, as the leg the vehicle is on in the route list. */
.line-legend__line[aria-current="true"] {
	background: var(--kern-color-layout-background-hued);
}

@media (forced-colors: active) {
	.line-legend__line[aria-current="true"] {
		outline-color: Highlight;
	}
}

.line-legend__text {
	display: grid;
}

.line-legend__name {
	font-weight: var(--kern-typography-font-weight-semi-bold);
}

.line-legend__length {
	margin-left: var(--kern-metric-space-x-small);
	color: var(--kern-color-layout-text-muted);
	font-size: var(--kern-font-size-14);
	font-weight: var(--kern-typography-font-weight-regular);
}

.line-legend__route {
	color: var(--kern-color-layout-text-muted);
	font-size: var(--kern-font-size-14);
}
</style>
