/** Map animations get this duration, or none if the user asked the system for less motion (WCAG 2.3.3). */
export function animationDuration (milliseconds: number): number {
	return window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : milliseconds
}
