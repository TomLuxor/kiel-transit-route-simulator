import type Collection from 'ol/Collection'
import type Control from 'ol/control/Control'

import { defaults as defaultControls } from 'ol/control/defaults'

/**
 * Button content with a visible symbol and a name for screen readers. OpenLayers puts only the symbol into
 * the button by default, so screen readers would announce "plus" instead of "Vergrößern".
 */
function buttonLabel (symbol: string, name: string): HTMLElement {
	const label = document.createElement('span')
	const symbolElement = document.createElement('span')
	symbolElement.setAttribute('aria-hidden', 'true')
	symbolElement.textContent = symbol
	const nameElement = document.createElement('span')
	nameElement.className = 'kern-sr-only'
	nameElement.textContent = name
	label.append(symbolElement, nameElement)
	return label
}

/** The default OpenLayers controls with accessible names; the attributions stay expanded. */
export function createControls (): Collection<Control> {
	return defaultControls({
		zoomOptions: {
			zoomInLabel: buttonLabel('+', 'Vergrößern'),
			zoomOutLabel: buttonLabel('−', 'Verkleinern'),
			zoomInTipLabel: 'Vergrößern',
			zoomOutTipLabel: 'Verkleinern',
		},
		rotateOptions: {
			label: buttonLabel('⇧', 'Karte nach Norden ausrichten'),
			tipLabel: 'Karte nach Norden ausrichten',
		},
		attributionOptions: {
			collapsible: false,
		},
	})
}
