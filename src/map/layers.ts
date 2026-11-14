import type { FeatureLike } from 'ol/Feature'
import type VectorSource from 'ol/source/Vector'

import TileLayer from 'ol/layer/Tile'
import VectorLayer from 'ol/layer/Vector'
import TileWMS from 'ol/source/TileWMS'
import { Fill, Stroke, Style, Text } from 'ol/style'

import { BACKGROUND_WMS } from './config'

/** Grey background map from the basemap.de WMS, so that the colored lines stand out. */
export function createBackgroundLayer (): TileLayer<TileWMS> {
	return new TileLayer({
		source: new TileWMS({
			url: BACKGROUND_WMS.url,
			params: { LAYERS: BACKGROUND_WMS.layer, FORMAT: 'image/png' },
			attributions: BACKGROUND_WMS.attribution,
			attributionsCollapsible: false,
			transition: 0,
		}),
	})
}

const casingStyle = new Style({ stroke: new Stroke({ color: 'rgba(255, 255, 255, 0.9)', width: 8 }) })
const lineStyle = new Style({ stroke: new Stroke({ color: '#1d3557', width: 4 }) })

/** Text of the `label` property, shown on the map only in development (to check the section table in PLAN.md). */
function labelStyle (feature: FeatureLike): Style | null {
	const label: unknown = feature.get('label')
	if (!import.meta.env.DEV || typeof label !== 'string') {
		return null
	}
	return new Style({
		text: new Text({
			text: label,
			font: '600 13px system-ui, sans-serif',
			fill: new Fill({ color: '#1d3557' }),
			stroke: new Stroke({ color: '#ffffff', width: 4 }),
		}),
	})
}

/** Route sections in one neutral style. Step 3 replaces this with one color per line. */
export function createSectionLayer (source: VectorSource): VectorLayer {
	return new VectorLayer({
		source,
		declutter: true,
		style: feature => {
			const label = labelStyle(feature)
			return label ? [casingStyle, lineStyle, label] : [casingStyle, lineStyle]
		},
	})
}
