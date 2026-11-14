import TileLayer from 'ol/layer/Tile'
import TileWMS from 'ol/source/TileWMS'

import { BACKGROUND_WMS } from './config'

/** Grey background map from the basemap.de WMS, so that the colored lines stand out. */
export function createBackgroundLayer (): TileLayer<TileWMS> {
	return new TileLayer({
		// Own class name: OpenLayers then draws this layer into its own element, which CSS can filter in dark mode.
		className: 'basemap',
		source: new TileWMS({
			url: BACKGROUND_WMS.url,
			params: { LAYERS: BACKGROUND_WMS.layer, FORMAT: 'image/png' },
			attributions: BACKGROUND_WMS.attribution,
			attributionsCollapsible: false,
			transition: 0,
		}),
	})
}
