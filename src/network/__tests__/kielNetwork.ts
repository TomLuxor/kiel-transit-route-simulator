import type { Coordinate } from 'ol/coordinate'

import { readFileSync } from 'node:fs'
import { fromLonLat } from 'ol/proj'

import { LINES } from '@/data/lines'
import { PLACES } from '@/data/places'
import { MAP_PROJECTION } from '@/map/config'

import { buildNetwork } from '../graph'
import { resolveLine } from '../lines'
import { resolvePlace } from '../places'
import { readSections, sectionParts } from '../sections'

/** Longitude and latitude to map coordinates; at Kiel, 0.001° is about 65 m east-west and 111 m north-south. */
export const at = (lon: number, lat: number): Coordinate => fromLonLat([lon, lat], MAP_PROJECTION)

/** The Kiel network built from the WFS snapshot of 14 November 2026, as the app builds it. */
const data: unknown = JSON.parse(readFileSync(new URL('fixtures/trassenabschnitte.geojson', import.meta.url), 'utf8'))
export const sections = readSections(data, MAP_PROJECTION)
export const network = buildNetwork(sectionParts(sections))
export const lines = LINES.map(line => resolveLine(network, line))
export const places = PLACES.map(place => resolvePlace(lines, place))
