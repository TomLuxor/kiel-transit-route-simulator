import { ref } from 'vue'

/** Text for a polite live region (`role="status"`), with `announce` to set it. */
export function useAnnouncer () {
	const message = ref('')

	function announce (text: string): void {
		// A live region only speaks when its text changes, so a repeated message gets an invisible difference.
		message.value = message.value === text ? `${text}\u00A0` : text
	}

	return { message, announce }
}
