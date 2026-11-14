import type { ProjectionLike } from 'ol/proj'

import GeoJSON from 'ol/format/GeoJSON'
import MultiLineString from 'ol/geom/MultiLineString'

/** WFS of the city of Kiel with the planned Stadtbahn route sections (open data, CC BY 4.0). */
const SECTIONS_WFS_URL = 'https://ims.kiel.de/geodatenextern/services/Stadtplan/LHKielWmsWfs/MapServer/WFSServer'
const SECTIONS_TYPE_NAME = 'lhkiel:Trassenabschnitte'

/** One feature of the WFS layer: a route section, or one of several features that make up a section. */
export interface Section {
	/** Feature ID in the WFS (`ogr_fid`), unique per feature. */
	readonly id: number
	/** Number of the section ("Abschnitt 5" is 5). Several features can share a number. */
	readonly sectionNumber: number
	readonly name: string
	readonly lengthMeters: number
	/** Geometry in the map projection. */
	readonly geometry: MultiLineString
}

function isRecord (value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null
}

/**
 * Checks the attributes and geometry of one WFS feature. The WFS GeoJSON names the attributes
 * `ogr_fid`, `Name` and `Länge__m_`, unlike the REST interface of the same server.
 */
function parseSection (properties: unknown, geometry: unknown): Section {
	if (!isRecord(properties)) {
		throw new Error('A route section has no attributes.')
	}
	const { ogr_fid: id, Name: name, Länge__m_: lengthMeters } = properties
	if (typeof id !== 'number' || typeof name !== 'string' || typeof lengthMeters !== 'number') {
		throw new Error('A route section has unexpected attributes.')
	}
	const sectionNumber = /^Abschnitt (?<number>\d+)$/u.exec(name)?.groups?.number
	if (sectionNumber === undefined) {
		throw new Error(`The route section name "${name}" has an unexpected format.`)
	}
	if (!(geometry instanceof MultiLineString)) {
		throw new Error(`The route section "${name}" is not a MultiLineString.`)
	}
	return { id, sectionNumber: Number(sectionNumber), name, lengthMeters, geometry }
}

/** Loads all route sections from the WFS, with the geometries transformed to `featureProjection`. */
export async function fetchSections (featureProjection: ProjectionLike, signal?: AbortSignal): Promise<Section[]> {
	const url = new URL(SECTIONS_WFS_URL)
	url.search = new URLSearchParams({
		service: 'WFS',
		version: '2.0.0',
		request: 'GetFeature',
		typeNames: SECTIONS_TYPE_NAME,
		outputFormat: 'GEOJSON',
		srsName: 'EPSG:4326',
	}).toString()

	const response = await fetch(url, { signal })
	if (!response.ok) {
		throw new Error(`The WFS answered with status ${String(response.status)}.`)
	}
	const data: unknown = await response.json()
	if (!isRecord(data)) {
		throw new Error('The WFS did not answer with GeoJSON.')
	}

	const features = new GeoJSON().readFeatures(data, { dataProjection: 'EPSG:4326', featureProjection })
	if (features.length === 0) {
		throw new Error('The WFS returned no route sections.')
	}
	return features.map(feature => parseSection(feature.getProperties(), feature.getGeometry()))
}
