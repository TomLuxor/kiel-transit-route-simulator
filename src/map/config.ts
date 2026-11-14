import type { Coordinate } from 'ol/coordinate'

/** Web Mercator, the OpenLayers default. The background WMS offers it, so no raster reprojection is needed. */
export const MAP_PROJECTION = 'EPSG:3857'

/** Kiel city centre, longitude and latitude. */
export const KIEL_CENTER: Coordinate = [10.13, 54.33]

export const INITIAL_ZOOM = 12

export const BACKGROUND_WMS = {
	url: 'https://sgx.geodatenzentrum.de/wms_basemapde',
	layer: 'de_basemapde_web_raster_grau',
	attribution: '© <a href="https://basemap.de">GeoBasis-DE / BKG</a> (2026) <a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a>',
} as const

/** As the WFS asks for it in its access constraints: "Landeshauptstadt Kiel, Lizenz CC-BY-4.0". */
export const SECTIONS_ATTRIBUTION = 'Stadtbahn: © <a href="https://www.kiel.de/stadtbahn">Landeshauptstadt Kiel</a>, <a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a>'
