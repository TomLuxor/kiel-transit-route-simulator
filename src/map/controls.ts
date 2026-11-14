import type Collection from 'ol/Collection'
import type Control from 'ol/control/Control'

import { defaults as defaultControls } from 'ol/control/defaults'

/**
 * Button content with a visible symbol and a name for screen readers. OpenLayers puts only the symbol into
 * the button by default, so screen readers would announce "plus" instead of "Zoom in".
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
			zoomInLabel: buttonLabel('+', 'Zoom in'),
			zoomOutLabel: buttonLabel('−', 'Zoom out'),
			zoomInTipLabel: 'Zoom in',
			zoomOutTipLabel: 'Zoom out',
		},
		rotateOptions: {
			label: buttonLabel('⇧', 'Reset rotation to north'),
			tipLabel: 'Reset rotation to north',
		},
		attributionOptions: {
			collapsible: false,
		},
	})
}
