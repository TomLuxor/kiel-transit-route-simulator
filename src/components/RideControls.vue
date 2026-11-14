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

/** One button that changes its label, so that keyboard focus stays on it for the whole ride. */
const MAIN_LABELS: Readonly<Record<RideStatus, string>> = {
	idle: 'Fahrt starten',
	running: 'Anhalten',
	paused: 'Weiter',
	arrived: 'Noch einmal fahren',
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
	<!-- A bar at the bottom of the side panel: it stays in view while the panel scrolls, on phones too. -->
	<div
		class="ride-controls"
		role="group"
		aria-label="Fahrt"
	>
		<div class="ride-controls__row">
			<button
				ref="mainButton"
				class="kern-btn kern-btn--primary"
				type="button"
				@click="onMain"
			>
				<span class="kern-label">{{ MAIN_LABELS[status] }}</span>
			</button>
			<button
				v-if="status !== 'idle'"
				class="kern-btn kern-btn--secondary"
				type="button"
				@click="onStop"
			>
				<span class="kern-label">Beenden</span>
			</button>
			<div class="ride-controls__speed">
				<label
					class="kern-label"
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
			<label
				class="kern-label kern-label--small"
				for="ride-progress"
			>
				Gefahren: {{ travelled }}
			</label>
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
	display: grid;
	gap: var(--kern-metric-space-small);

	/* Across the full width of the panel, over its padding. */
	margin: 0 calc(-1 * var(--kern-metric-space-default));
	padding: var(--kern-metric-space-small) var(--kern-metric-space-default);
	background: var(--kern-color-layout-background-default);
	border-top: var(--kern-metric-border-width-light) solid var(--kern-color-layout-border);
}

.ride-controls__row {
	display: flex;
	flex-wrap: wrap;
	gap: var(--kern-metric-space-small);
	align-items: center;
}

.ride-controls__row .kern-btn {
	margin: 0;
}

/* Label and list in one row, at the end of the bar. */
.ride-controls__speed {
	display: flex;
	gap: var(--kern-metric-space-small);
	align-items: center;
	margin-left: auto;
}

.ride-controls__speed .kern-label {
	margin: 0;
}

.ride-controls__speed .kern-form-input__select-wrapper {
	width: 8rem;
}

/* KERN's progress bar reads "-contextual" tokens, which exist only inside KERN's layer containers. */
.ride-controls__progress {
	--kern-color-feedback-default-contextual: var(--kern-color-feedback-default);
	--kern-color-feedback-default-background-contextual: var(--kern-color-feedback-default-background);

	gap: var(--kern-metric-space-x-small);
}

.ride-controls__progress .kern-label {
	margin: 0;
}

.ride-controls__message {
	margin: 0;
	font-size: var(--kern-font-size-14);
}
</style>
