import { ref } from 'vue'

/**
 * Text for a polite live region (`role="status"`), with `announce` to set it.
 *
 * Most messages confirm what the user just did or what the page shows anyway ("Start und Ziel getauscht.",
 * "Fahrt beendet."): screen readers hear them, but the page does not show them, so the side panel stays calm.
 * A message that tells something not to be seen otherwise, such as a refused choice or a pause the user did
 * not ask for, is announced with `shown` and appears on the page as well.
 */
export function useAnnouncer () {
	const message = ref('')
	/** Whether the message is shown on the page, not only read out. */
	const shown = ref(false)

	function announce (text: string, options: { shown?: boolean } = {}): void {
		// A live region only speaks when its text changes, so a repeated message gets an invisible difference.
		message.value = message.value === text ? `${text}\u00A0` : text
		shown.value = options.shown ?? false
	}

	/** Removes the message, for example a refusal once a valid choice has been made. Says nothing. */
	function clear (): void {
		message.value = ''
		shown.value = false
	}

	return { message, shown, announce, clear }
}
