import type { ProjectionLike } from 'ol/proj'

import GeoJSON from 'ol/format/GeoJSON'
import MultiLineString from 'ol/geom/MultiLineString'

import type { NetworkPart } from './graph'

/** WFS of the city of Kiel with the planned Stadtbahn route sections (open data, CC BY 4.0). */
const SECTIONS_WFS_URL = 'https://ims.kiel.de/geodatenextern/services/Stadtplan/LHKielWmsWfs/MapServer/WFSServer'
const SECTIONS_TYPE_NAME = 'lhkiel:Trassenabschnitte'

/** Longest wait for the WFS, in milliseconds. Its answer is about 100 kB: a few seconds even on a slow phone network. */
const WFS_TIMEOUT_MS = 15_000

const NOT_GEOJSON = 'Der WFS hat nicht mit GeoJSON geantwortet.'

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
		throw new Error('Ein Streckenabschnitt hat keine Attribute.')
	}
	const { ogr_fid: id, Name: name, Länge__m_: lengthMeters } = properties
	if (typeof id !== 'number' || typeof name !== 'string' || typeof lengthMeters !== 'number') {
		throw new Error('Ein Streckenabschnitt hat unerwartete Attribute.')
	}
	const sectionNumber = /^Abschnitt (?<number>\d+)$/u.exec(name)?.groups?.number
	if (sectionNumber === undefined) {
		throw new Error(`Der Name des Streckenabschnitts „${name}“ hat ein unerwartetes Format.`)
	}
	if (!(geometry instanceof MultiLineString)) {
		throw new Error(`Der Streckenabschnitt „${name}“ ist kein MultiLineString.`)
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

	// A server that hangs would keep the page loading until the browser gives up, after minutes.
	const timeout = AbortSignal.timeout(WFS_TIMEOUT_MS)
	const combined = signal ? AbortSignal.any([signal, timeout]) : timeout

	// The browser's own messages ("Failed to fetch", "The operation timed out") mean nothing to users. A request
	// cancelled by the caller is passed on as it is, so the caller can ignore it.
	function failure (error: unknown, otherwise: string): unknown {
		if (signal?.aborted) {
			return error
		}
		return new Error(timeout.aborted ? 'Der Kartenserver der Landeshauptstadt Kiel antwortet nicht.' : otherwise)
	}

	const response = await fetch(url, { signal: combined }).catch((error: unknown) => {
		throw failure(error, 'Der Kartenserver der Landeshauptstadt Kiel ist nicht erreichbar.')
	})
	if (!response.ok) {
		throw new Error(`Der Kartenserver der Landeshauptstadt Kiel hat mit einem Fehler geantwortet (Status ${String(response.status)}).`)
	}
	// Reading the answer can time out as well, or fail on something that is not JSON.
	const data: unknown = await response.json().catch((error: unknown) => {
		throw failure(error, NOT_GEOJSON)
	})
	return readSections(data, featureProjection)
}

/** Checks a GeoJSON answer of the WFS (in EPSG:4326) and turns it into sections in `featureProjection`. */
export function readSections (data: unknown, featureProjection: ProjectionLike): Section[] {
	if (!isRecord(data)) {
		throw new Error(NOT_GEOJSON)
	}
	const features = new GeoJSON().readFeatures(data, { dataProjection: 'EPSG:4326', featureProjection })
	if (features.length === 0) {
		throw new Error('Der WFS hat keine Streckenabschnitte geliefert.')
	}
	return features.map(feature => parseSection(feature.getProperties(), feature.getGeometry()))
}

/** The line parts of all sections, as input for the network graph. */
export function sectionParts (sections: readonly Section[]): NetworkPart[] {
	return sections.flatMap(section => section.geometry.getLineStrings()
		.map(lineString => ({ sectionId: section.id, coordinates: lineString.getCoordinates() })))
}
