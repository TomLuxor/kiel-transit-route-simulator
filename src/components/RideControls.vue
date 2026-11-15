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
		A bar at the bottom of the side panel: it stays in view while the panel scrolls, on phones too.
		The first row is the same in every state: the main button and the speed. "Beenden" belongs to the
		ride under way, so it stands next to how far the ride has come.
	-->
	<div
		class="ride-controls"
		role="group"
		aria-label="Fahrt"
	>
		<div class="ride-controls__row">
			<button
				ref="mainButton"
				class="kern-btn kern-btn--primary ride-controls__main"
				type="button"
				@click="onMain"
			>
				<span class="kern-label">{{ MAIN_LABELS[status] }}</span>
			</button>
			<div class="ride-controls__speed">
				<label
					class="ride-controls__speed-label"
					for="ride-speed"
				>
					Tempo
				</label>
				<div class="kern-form-input__select-wrapper">
					<select
						id="ride-speed"
						v-model="speed"
						class="kern-form-input__select"
					>
						<option
							v-for="option in SPEEDS"
							:key="option.id"
							:value="option.id"
						>
							{{ option.label }}
						</option>
					</select>
				</div>
			</div>
		</div>
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
			role="status"
		>
			{{ message }}
		</p>
	</div>
</template>

<style scoped>
.ride-controls {
	position: sticky;
	bottom: calc(-1 * var(--kern-metric-space-default));
	z-index: 1;
	container: ride-controls / inline-size;
	display: grid;
	gap: var(--kern-metric-space-small);

	/* Across the full width of the panel, over its padding. */
	margin: 0 calc(-1 * var(--kern-metric-space-default));
	padding: var(--kern-metric-space-small) var(--kern-metric-space-default);
	background: var(--kern-color-layout-background-default);
	border-top: var(--kern-metric-border-width-light) solid var(--kern-color-layout-border);
}

/*
 * Main button and speed in one row; the button takes the space left over. In a narrow panel (a phone in
 * landscape) the speed moves below and the button spans the whole row, so the bar still looks deliberate.
 */
.ride-controls__row {
	display: flex;
	flex-wrap: wrap;
	gap: var(--kern-metric-space-small);
	align-items: center;
}

.ride-controls__main {
	flex: 1 0 auto;
	margin: 0;
}

.ride-controls__speed {
	display: flex;
	gap: var(--kern-metric-space-small);
	align-items: center;
}

/* A secondary setting: regular weight, so it does not compete with the labels of the form. */
.ride-controls__speed-label {
	font-size: var(--kern-typography-font-size-small-static);
}

/* Wide enough for "Langsam" next to KERN's arrow. */
.ride-controls__speed .kern-form-input__select-wrapper {
	width: 8rem;
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

/* In a narrow bar (a phone in landscape), "Beenden" stays beside the distance; screen readers still hear "Gefahren". */
@container ride-controls (width < 22rem) {
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
