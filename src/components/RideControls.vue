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
	<div
		class="ride-controls"
		role="group"
		aria-label="Fahrt"
	>
		<div class="ride-controls__buttons">
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
		</div>
		<div
			v-if="status !== 'idle'"
			class="kern-progress ride-controls__progress"
		>
			<label
				class="kern-label"
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
		<fieldset class="kern-fieldset">
			<legend class="kern-label">
				Tempo
			</legend>
			<div class="kern-fieldset__body kern-fieldset__body--horizontal">
				<div
					v-for="option in SPEEDS"
					:key="option.id"
					class="kern-form-check"
				>
					<input
						:id="`ride-speed-${option.id}`"
						v-model="speed"
						class="kern-form-check__radio"
						type="radio"
						name="ride-speed"
						:value="option.id"
					>
					<label
						class="kern-label"
						:for="`ride-speed-${option.id}`"
					>
						{{ option.label }}
					</label>
				</div>
			</div>
		</fieldset>
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
	display: grid;
	gap: var(--kern-metric-space-small);
	margin-bottom: var(--kern-metric-space-small);
}

.ride-controls__buttons {
	display: flex;
	flex-wrap: wrap;
	gap: var(--kern-metric-space-small);
}

/* KERN's progress bar reads "-contextual" tokens, which exist only inside KERN's layer containers. */
.ride-controls__progress {
	--kern-color-feedback-default-contextual: var(--kern-color-feedback-default);
	--kern-color-feedback-default-background-contextual: var(--kern-color-feedback-default-background);
}

.ride-controls__message {
	margin: 0;
}
</style>
