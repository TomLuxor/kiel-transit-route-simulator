<script setup lang="ts">
import { computed, nextTick } from 'vue'

import type { ResolvedPlace } from '@/network/places'

import { type Endpoint, ENDPOINT_WORDS } from '@/composables/useRouteSelection'
import { describeLines, placePoint, type RoutePoint } from '@/network/routePoints'

const props = defineProps<{
	places: readonly ResolvedPlace[]
	start: RoutePoint | undefined
	destination: RoutePoint | undefined
	/** Result of the last map click or refused choice, for the live region. */
	message: string
}>()

const clickTarget = defineModel<Endpoint>('clickTarget', { required: true })

const emit = defineEmits<{
	choose: [endpoint: Endpoint, point: RoutePoint]
	swap: []
}>()

/** Alphabetical, so that typing the first letters in a closed list jumps to a place. */
const sortedPlaces = computed(() => [...props.places].sort((a, b) => a.definition.name.localeCompare(b.definition.name, 'de')))

const fields = computed(() => [
	{ endpoint: 'start', title: ENDPOINT_WORDS.start.title, point: props.start, other: props.destination },
	{ endpoint: 'destination', title: ENDPOINT_WORDS.destination.title, point: props.destination, other: props.start },
] as const)

async function onChange (endpoint: Endpoint, event: Event): Promise<void> {
	const select = event.target
	if (!(select instanceof HTMLSelectElement)) {
		return
	}
	const place = props.places.find(candidate => candidate.definition.id === select.value)
	if (place) {
		emit('choose', endpoint, placePoint(place))
	}
	// A refused choice leaves the props unchanged, so the list has to show the current choice again by itself.
	await nextTick()
	select.value = (endpoint === 'start' ? props.start : props.destination)?.id ?? ''
}
</script>

<template>
	<form
		class="route-form"
		aria-labelledby="route-form-title"
		@submit.prevent
	>
		<!-- Not shown, but it names the form and lets screen reader users jump to it. -->
		<h2
			id="route-form-title"
			class="app-visually-hidden"
		>
			Start und Ziel
		</h2>
		<p class="route-form__intro">
			Start und Ziel in der Karte auf eine Linie setzen, dann die Fahrt starten.
		</p>
		<div
			v-for="field in fields"
			:key="field.endpoint"
			class="kern-form-input"
		>
			<div class="route-form__label-row">
				<label
					class="kern-label route-form__label"
					:for="`route-${field.endpoint}`"
				>
					<!-- The marker as on the map, so that the label doubles as its legend. -->
					<svg
						class="route-form__marker"
						viewBox="0 0 28 28"
						width="28"
						height="28"
						aria-hidden="true"
						focusable="false"
					>
						<template v-if="field.endpoint === 'start'">
							<circle
								class="route-form__marker-start"
								cx="14"
								cy="14"
								r="9"
							/>
						</template>
						<template v-else>
							<circle
								class="route-form__marker-halo"
								cx="14"
								cy="14"
								r="13"
							/>
							<circle
								class="route-form__marker-destination"
								cx="14"
								cy="14"
								r="9"
							/>
						</template>
					</svg>
					{{ field.title }}
				</label>
				<button
					v-if="field.endpoint === 'destination'"
					class="kern-btn kern-btn--tertiary kern-btn--small"
					type="button"
					:disabled="!start && !destination"
					@click="emit('swap')"
				>
					<svg
						class="route-form__swap-icon"
						viewBox="0 0 24 24"
						width="24"
						height="24"
						aria-hidden="true"
						focusable="false"
					>
						<path d="M8 4v15M4 15l4 4 4-4M16 20V5M12 9l4-4 4 4" />
					</svg>
					<span class="kern-label">Tauschen<span class="app-visually-hidden"> (Start und Ziel)</span></span>
				</button>
			</div>
			<div class="kern-form-input__select-wrapper">
				<select
					:id="`route-${field.endpoint}`"
					class="kern-form-input__select"
					:value="field.point?.id ?? ''"
					@change="onChange(field.endpoint, $event)"
				>
					<option
						value=""
						disabled
					>
						Halt wählen
					</option>
					<option
						v-if="field.point?.kind === 'point'"
						:value="field.point.id"
					>
						{{ field.point.name }}
					</option>
					<option
						v-for="place in sortedPlaces"
						:key="place.definition.id"
						:value="place.definition.id"
						:disabled="place.definition.id === field.other?.id"
					>
						{{ place.definition.name }} ({{ describeLines(place.lineIds) }})
					</option>
				</select>
			</div>
		</div>
		<fieldset class="kern-fieldset route-form__click-target">
			<legend class="kern-label">
				Kartenklick wählt
			</legend>
			<div class="kern-fieldset__body kern-fieldset__body--horizontal">
				<div
					v-for="field in fields"
					:key="field.endpoint"
					class="kern-form-check"
				>
					<input
						:id="`click-target-${field.endpoint}`"
						v-model="clickTarget"
						class="kern-form-check__radio"
						type="radio"
						name="click-target"
						:value="field.endpoint"
					>
					<label
						class="kern-label"
						:for="`click-target-${field.endpoint}`"
					>
						{{ field.title }}
					</label>
				</div>
			</div>
		</fieldset>
		<p
			class="route-form__message"
			role="status"
		>
			{{ message }}
		</p>
	</form>
</template>

<style scoped>
.route-form {
	display: grid;
	gap: var(--kern-metric-space-default);
}

.route-form__intro,
.route-form__message {
	margin: 0;
}

.route-form__label-row {
	display: flex;
	gap: var(--kern-metric-space-small);
	justify-content: space-between;
	align-items: flex-end;
	align-self: stretch;
}

.route-form__label {
	display: inline-flex;
	gap: var(--kern-metric-space-x-small);
	align-items: center;
}

.route-form__marker {
	flex: none;
	width: 1.5rem;
	height: 1.5rem;
}

/* The same colors as the markers on the map (src/map/selectionLayer.ts). */
.route-form__marker-start {
	fill: var(--app-color-on-signal);
	stroke: var(--kern-color-white);
	stroke-width: 3;
}

.route-form__marker-halo {
	fill: var(--kern-color-white);
}

.route-form__marker-destination {
	fill: var(--app-color-signal);
	stroke: var(--app-color-on-signal);
	stroke-width: 4;
}

/* Legend and choices in one row, to save height on phones. KERN floats the legend; the body goes beside it. */
.route-form__click-target legend.kern-label {
	margin: 0 var(--kern-metric-space-default) 0 0;
}

.route-form__click-target .kern-fieldset__body {
	clear: none;
	gap: var(--kern-metric-space-small);
	width: auto;
}

.route-form__click-target .kern-form-check {
	padding-right: 0;
}

/* In the action blue of the button label; through currentColor it follows Windows high contrast mode. */
.route-form__swap-icon {
	flex: none;
	width: 1.25rem;
	height: 1.25rem;
	color: var(--kern-color-action-default);
	fill: none;
	stroke: currentColor;
	stroke-width: 2;
	stroke-linecap: round;
	stroke-linejoin: round;
}
</style>
