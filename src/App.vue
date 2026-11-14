<script setup lang="ts">
import { computed, useTemplateRef } from 'vue'

import MapView from '@/components/MapView.vue'
import { useSections } from '@/composables/useSections'
import { MAP_PROJECTION } from '@/map/config'

const { sections, status, errorMessage, load } = useSections(MAP_PROJECTION)
const statusMessage = useTemplateRef<HTMLParagraphElement>('statusMessage')

const statusText = computed(() => {
	switch (status.value) {
		case 'loading':
			return 'Loading the Stadtbahn network…'
		case 'error':
			return `The Stadtbahn network could not be loaded. ${errorMessage.value}`
		case 'ready': {
			const kilometers = sections.value.reduce((sum, section) => sum + section.lengthMeters, 0) / 1000
			return `Stadtbahn network loaded: ${String(sections.value.length)} route sections, ${kilometers.toFixed(1)} km.`
		}
	}
})

/** The button disappears while loading, so focus moves to the status message instead of getting lost. */
function retry (): void {
	load()
	statusMessage.value?.focus()
}
</script>

<template>
	<header class="app-header">
		<div class="app-header__brand">
			<svg
				class="app-logo"
				viewBox="0 0 32 32"
				width="32"
				height="32"
				aria-hidden="true"
				focusable="false"
			>
				<rect
					class="app-logo__plate"
					width="32"
					height="32"
					rx="6"
				/>
				<path
					class="app-logo__route"
					d="M8 23 L14 15 L19 18 L24 9"
				/>
				<circle
					class="app-logo__start"
					cx="8"
					cy="23"
					r="3.5"
				/>
				<circle
					class="app-logo__destination"
					cx="24"
					cy="9"
					r="3.5"
				/>
			</svg>
			<h1 class="app-header__title">
				Kiel Transit Route Simulator
			</h1>
		</div>
		<p class="app-header__note">
			Student project, not an official service of the Landeshauptstadt Kiel.
		</p>
	</header>
	<main class="app-main">
		<div
			class="status-bar"
			:class="`status-bar--${status}`"
		>
			<span
				v-if="status === 'loading'"
				class="kern-loader kern-loader--visible status-bar__loader"
				aria-hidden="true"
			/>
			<span
				v-else-if="status === 'error'"
				class="kern-icon kern-icon--danger status-bar__icon"
				aria-hidden="true"
			/>
			<p
				ref="statusMessage"
				class="status-bar__message"
				role="status"
				tabindex="-1"
			>
				{{ statusText }}
			</p>
			<button
				v-if="status === 'error'"
				class="kern-btn kern-btn--secondary kern-btn--small"
				type="button"
				@click="retry"
			>
				<span
					class="kern-icon kern-icon--autorenew"
					aria-hidden="true"
				/>
				<span class="kern-label">Try again</span>
			</button>
		</div>
		<MapView :sections="sections" />
	</main>
</template>

<style scoped>
.app-header {
	display: flex;
	flex-wrap: wrap;
	gap: var(--kern-metric-space-x-small) var(--kern-metric-space-default);
	justify-content: space-between;
	align-items: center;
	padding: var(--kern-metric-space-small) var(--kern-metric-space-default);
	border-bottom: var(--kern-metric-border-width-bold) solid var(--app-color-signal);
}

.app-header__brand {
	display: flex;
	gap: var(--kern-metric-space-small);
	align-items: center;
}

.app-header__title {
	margin: 0;
	font-size: var(--kern-typography-font-size-large-static);
	font-weight: var(--kern-typography-font-weight-semi-bold);
	line-height: 1.2;
}

.app-header__note {
	margin: 0;
	color: var(--kern-color-layout-text-muted);
	font-size: var(--kern-font-size-14);
}

/* Logo: a route between two points on a signal-yellow plate, in the style of a transit sign. */
.app-logo {
	flex: none;
}

.app-logo__plate {
	fill: var(--app-color-signal);
}

.app-logo__route {
	fill: none;
	stroke: var(--app-color-on-signal);
	stroke-width: 3;
	stroke-linecap: round;
	stroke-linejoin: round;
}

.app-logo__start {
	fill: var(--app-color-on-signal);
}

.app-logo__destination {
	fill: var(--app-color-signal);
	stroke: var(--app-color-on-signal);
	stroke-width: 2.5;
}

.app-main {
	display: grid;
	grid-template-rows: auto 1fr;
	min-height: 0;
}

.status-bar {
	display: flex;
	flex-wrap: wrap;
	gap: var(--kern-metric-space-small) var(--kern-metric-space-default);
	align-items: center;
	min-height: 44px;
	padding: var(--kern-metric-space-x-small) var(--kern-metric-space-default);
	background: var(--kern-color-layout-background-hued);
	border-bottom: var(--kern-metric-border-width-light) solid var(--kern-color-layout-border);
}

.status-bar__message {
	flex: 1 1 16rem;
	margin: 0;
}

.status-bar__loader {
	width: 1.25rem;
	height: 1.25rem;
	border-width: 3px;
}

.status-bar__icon {
	margin: 0;
}

.status-bar--error {
	background: var(--kern-color-feedback-danger-background);
	border-left: var(--kern-metric-border-width-bold) solid var(--kern-color-feedback-danger);
}
</style>
