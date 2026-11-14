/** True if the user asked the system for less motion (WCAG 2.3.3). */
export function prefersReducedMotion (): boolean {
	return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/** Map animations get this duration, or none with reduced motion. */
export function animationDuration (milliseconds: number): number {
	return prefersReducedMotion() ? 0 : milliseconds
}
