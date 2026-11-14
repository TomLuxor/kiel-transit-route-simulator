import type { ProjectionLike } from 'ol/proj'

import { onBeforeUnmount, onMounted, readonly, ref, shallowRef } from 'vue'

import { fetchSections, type Section } from '@/network/sections'

export type LoadStatus = 'loading' | 'ready' | 'error'

/** Loads the route sections when the component mounts and keeps the loading state. */
export function useSections (featureProjection: ProjectionLike) {
	// shallowRef: OpenLayers geometries must not be wrapped in deep reactive proxies.
	const sections = shallowRef<readonly Section[]>([])
	const status = ref<LoadStatus>('loading')
	const errorMessage = ref('')
	let controller: AbortController | undefined

	/** Starts loading; a running request is cancelled. Errors end up in `status` and `errorMessage`. */
	function load (): void {
		controller?.abort()
		const current = new AbortController()
		controller = current
		status.value = 'loading'
		errorMessage.value = ''
		fetchSections(featureProjection, current.signal)
			.then(result => {
				sections.value = result
				status.value = 'ready'
			})
			.catch((error: unknown) => {
				if (current.signal.aborted) {
					return
				}
				errorMessage.value = error instanceof Error ? error.message : 'Unknown error.'
				status.value = 'error'
			})
	}

	onMounted(load)
	onBeforeUnmount(() => {
		controller?.abort()
	})

	return {
		sections,
		status: readonly(status),
		errorMessage: readonly(errorMessage),
		load,
	}
}
