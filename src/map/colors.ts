/**
 * Colors for the map canvas, which cannot read CSS variables: the KERN tokens named, converted to hex.
 * The canvas keeps these colors in dark mode; the white casing and halos keep them readable on the
 * inverted background map.
 */
export const MAP_COLORS = {
	/** White outline around lines, badges and markers, and the halo behind labels. */
	casing: '#ffffff',
	/** KERN neutral-950, the default text color of the light theme. */
	ink: '#131525',
	/** KERN yellow-150, the signal yellow of the transit layer (`--app-color-signal`). */
	signal: '#f8cf00',
	/** KERN black, the text color on signal yellow (`--app-color-on-signal`). */
	onSignal: '#000000',
	/** KERN neutral-450, the part of the route already travelled; 3.5:1 against the white casing. */
	travelled: '#8187a7',
} as const
