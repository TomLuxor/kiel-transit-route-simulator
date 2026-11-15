/**
 * The pin that marks start and destination, on the map and as their legend in the form: the only shape on the
 * map that is not round (places, changes, line badges and the vehicle are all discs), so the two points the
 * user chose stand out at a glance. The tip marks the point; the head carries a dot.
 */
export const PIN = {
	/** Size of the drawing in pixels. */
	width: 36,
	height: 48,
	/** The tip, which sits on the point. */
	tip: [18, 44] as const,
	/** Center and radius of the dot in the head. */
	dot: { x: 18, y: 18, radius: 5 },
	/** Outline of the pin: a circle of radius 13 around the dot that narrows down to the tip. */
	path: 'M18 44C15 37 5 29 5 18a13 13 0 0 1 26 0c0 11-10 19-13 26z',
} as const
