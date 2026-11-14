import type Collection from 'ol/Collection'

import Control from 'ol/control/Control'
import { defaults as defaultControls } from 'ol/control/defaults'

const SVG_NAMESPACE = 'http://www.w3.org/2000/svg'

/**
 * Button content with a visible symbol and a name for screen readers. OpenLayers puts only the symbol into
 * the button by default, so screen readers would announce "plus" instead of "Vergrößern".
 */
function buttonLabel (symbol: string | Element, name: string): HTMLElement {
	const label = document.createElement('span')
	const symbolElement = document.createElement('span')
	symbolElement.setAttribute('aria-hidden', 'true')
	symbolElement.append(symbol)
	const nameElement = document.createElement('span')
	nameElement.className = 'kern-sr-only'
	nameElement.textContent = name
	label.append(symbolElement, nameElement)
	return label
}

/** Four corners, the usual symbol for "show everything". Drawn as SVG, because no font has it everywhere. */
function fitSymbol (): SVGSVGElement {
	const svg = document.createElementNS(SVG_NAMESPACE, 'svg')
	svg.setAttribute('viewBox', '0 0 24 24')
	svg.setAttribute('width', '22')
	svg.setAttribute('height', '22')
	const path = document.createElementNS(SVG_NAMESPACE, 'path')
	path.setAttribute('d', 'M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5')
	path.setAttribute('fill', 'none')
	path.setAttribute('stroke', 'currentColor')
	path.setAttribute('stroke-width', '2.5')
	path.setAttribute('stroke-linecap', 'round')
	path.setAttribute('stroke-linejoin', 'round')
	svg.append(path)
	return svg
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

/**
 * A button below the zoom buttons that shows the whole network again, for example after a ride. Not the
 * OpenLayers ZoomToExtent control, because that fits without padding and without animation.
 */
export function createFitControl (fit: () => void): Control {
	const button = document.createElement('button')
	button.type = 'button'
	button.title = 'Ganzes Netz zeigen'
	button.append(buttonLabel(fitSymbol(), 'Ganzes Netz zeigen'))
	button.addEventListener('click', fit)
	const element = document.createElement('div')
	element.className = 'app-fit ol-unselectable ol-control'
	element.append(button)
	return new Control({ element })
}
