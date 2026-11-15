<script setup lang="ts">
import { computed, nextTick, useTemplateRef } from 'vue'

import { RIDE_SPEEDS, type RideSpeed, type RideStatus } from '@/composables/useRide'
import { formatDistance } from '@/network/routePoints'

const props = defineProps<{
	status: RideStatus
	/** Share of the route travelled, from 0 to 1. */
	progress: number
	lengthMeters: number
	/** Departure, changes and arrival, for the live region. */
	message: string
	/** The message is shown, not only read out: a pause the user did not ask for. */
	messageShown: boolean
}>()

const speed = defineModel<RideSpeed>('speed', { required: true })

const emit = defineEmits<{
	start: []
	pause: []
	resume: []
	stop: []
}>()

const mainButton = useTemplateRef<HTMLButtonElement>('mainButton')

/**
 * One button that changes its label, so that keyboard focus stays on it for the whole ride. After the
 * arrival it starts the ride again; the message says that the ride has arrived.
 */
const MAIN_LABELS: Readonly<Record<RideStatus, string>> = {
	idle: 'Fahrt starten',
	running: 'Anhalten',
	paused: 'Weiter',
	arrived: 'Fahrt starten',
}

const SPEEDS = (['slow', 'normal', 'fast'] as const).map(id => ({ id, label: RIDE_SPEEDS[id].label }))

const travelled = computed(() => `${formatDistance(props.progress * props.lengthMeters)} von ${formatDistance(props.lengthMeters)}`)

function onMain (): void {
	if (props.status === 'running') {
		emit('pause')
	} else if (props.status === 'paused') {
		emit('resume')
	} else {
		emit('start')
	}
}

/** "Beenden" disappears with the ride, so focus moves to the main button instead of getting lost. */
async function onStop (): Promise<void> {
	emit('stop')
	await nextTick()
	mainButton.value?.focus()
}
</script>

<template>
	<!--
		The end of the route block: it stays in view at the bottom of the side panel while the panel scrolls,
		on phones too. The main button and the speed are the same in every state, both as wide as the fields
		above. "Beenden" belongs to the ride under way, so it stands next to how far the ride has come.
	-->
	<div
		class="ride-controls"
		role="group"
		aria-label="Fahrt"
	>
		<div class="ride-controls__bar">
			<button
				ref="mainButton"
				class="kern-btn kern-btn--primary ride-controls__main"
				type="button"
				@click="onMain"
			>
				<span class="kern-label">{{ MAIN_LABELS[status] }}</span>
			</button>
			<!--
				The speed as three switches side by side: every choice in view and one click away. A native radio
				group, so the arrow keys move between them. The name "Tempo" is only read out: next to the ride
				button, "Langsam", "Normal" and "Schnell" speak for themselves.
			-->
			<fieldset class="ride-controls__speed">
				<legend class="app-visually-hidden">
					Tempo
				</legend>
				<label
					v-for="option in SPEEDS"
					:key="option.id"
					class="ride-controls__speed-option"
				>
					<input
						v-model="speed"
						class="app-visually-hidden"
						type="radio"
						name="ride-speed"
						:value="option.id"
					>
					{{ option.label }}
				</label>
			</fieldset>
			<div
				v-if="status !== 'idle'"
				class="kern-progress ride-controls__progress"
			>
				<div class="ride-controls__progress-row">
					<label
						class="ride-controls__progress-label"
						for="ride-progress"
					>
						<span class="ride-controls__progress-prefix">Gefahren: </span>{{ travelled }}
					</label>
					<button
						class="kern-btn kern-btn--tertiary kern-btn--small"
						type="button"
						@click="onStop"
					>
						<span class="kern-label">Beenden</span>
					</button>
				</div>
				<progress
					id="ride-progress"
					:value="progress"
					max="1"
				>
					{{ travelled }}
				</progress>
			</div>
			<p
				class="ride-controls__message"
				:class="{ 'app-visually-hidden': !messageShown }"
				role="status"
			>
				{{ message }}
			</p>
		</div>
	</div>
</template>

<style scoped>
/*
 * Sticky at the bottom of the side panel, across its full width over its padding. The sticky element is also
 * the container for the queries below: its width, and whether it is stuck.
 */
.ride-controls {
	position: sticky;
	bottom: calc(-1 * var(--kern-metric-space-default));
	z-index: 1;
	container: ride-controls / inline-size scroll-state;

	/* Above, it takes back its own padding, so the button keeps the spacing of the route block. */
	margin: calc(-1 * var(--kern-metric-space-small)) calc(-1 * var(--kern-metric-space-default)) 0;
}

/*
 * In its place, the bar belongs to the route above it and has no line of its own. A line shows only while the
 * bar is stuck at the bottom, floating over the content that scrolls below it. Browsers that cannot tell
 * (scroll-state queries) always show the line.
 */
.ride-controls__bar {
	display: grid;
	gap: var(--kern-metric-space-small);
	padding: var(--kern-metric-space-small) var(--kern-metric-space-default);
	background: var(--kern-color-layout-background-default);
	border-top: var(--kern-metric-border-width-light) solid var(--kern-color-layout-border);
}

@supports (container-type: scroll-state) {
	.ride-controls__bar {
		border-top-color: transparent;
	}

	@container ride-controls scroll-state(stuck: bottom) {
		.ride-controls__bar {
			border-top-color: var(--kern-color-layout-border);
		}
	}
}

/* The button across the bar, as wide as the fields above. */
.ride-controls__main {
	width: 100%;
	margin: 0;
}

/* Three switches of equal width in one frame, the one chosen marked by a tint, a frame of its own and bold text. */
.ride-controls__speed {
	display: grid;
	grid-template-columns: repeat(3, 1fr);
	min-width: 0;
	margin: 0;
	padding: 0;
	border: var(--kern-metric-border-width-light) solid var(--kern-color-layout-border);
	border-radius: var(--kern-metric-border-radius-default);
}

.ride-controls__speed-option {
	display: flex;
	justify-content: center;
	align-items: center;
	min-height: 2.5rem;
	padding: 0 var(--kern-metric-space-x-small);
	color: var(--kern-color-layout-text-default);
	cursor: pointer;
}

.ride-controls__speed-option + .ride-controls__speed-option {
	border-left: var(--kern-metric-border-width-light) solid var(--kern-color-layout-border);
}

.ride-controls__speed-option:first-of-type {
	border-radius: var(--kern-metric-border-radius-default) 0 0 var(--kern-metric-border-radius-default);
}

.ride-controls__speed-option:last-of-type {
	border-radius: 0 var(--kern-metric-border-radius-default) var(--kern-metric-border-radius-default) 0;
}

.ride-controls__speed-option:hover {
	background: var(--kern-color-action-state-indicator-tint-hover-opacity);
}

.ride-controls__speed-option:has(:checked) {
	color: var(--kern-color-action-default);
	font-weight: var(--kern-typography-font-weight-semi-bold);
	background: var(--kern-color-action-state-indicator-tint-hover-opacity);
	outline: 2px solid var(--kern-color-action-default);
	outline-offset: -2px;
}

.ride-controls__speed-option:has(:focus-visible) {
	position: relative;
	z-index: 1;
	outline: var(--app-focus-outline);
	outline-offset: 2px;
}

@media (forced-colors: active) {
	.ride-controls__speed-option:has(:checked) {
		outline-color: Highlight;
	}
}

.ride-controls__progress {
	gap: var(--kern-metric-space-x-small);
}

.ride-controls__progress-row {
	display: flex;
	flex-wrap: wrap;
	gap: var(--kern-metric-space-x-small) var(--kern-metric-space-small);
	justify-content: space-between;
	align-items: center;
	align-self: stretch;
}

.ride-controls__progress-row .kern-btn {
	margin: 0;
}

.ride-controls__progress-label,
.ride-controls__message {
	margin: 0;
	font-size: var(--kern-font-size-14);
}

/*
 * A narrow bar (a phone in landscape): "Beenden" stays beside the distance, and screen readers still hear
 * "Gefahren".
 */
@container ride-controls (width < 18.5rem) {
	.ride-controls__progress-prefix {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		white-space: nowrap;
		clip-path: inset(50%);
	}
}
</style>
