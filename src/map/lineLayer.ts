import type { Coordinate } from 'ol/coordinate'

import Feature from 'ol/Feature'
import LineString from 'ol/geom/LineString'
import VectorLayer from 'ol/layer/Vector'
import VectorSource from 'ol/source/Vector'
import { Stroke, Style } from 'ol/style'

import type { LineDefinition } from '@/data/lines'
import type { ResolvedLine } from '@/network/lines'

import { itemAt, type Network } from '@/network/graph'

import { MAP_COLORS } from './colors'
import { SECTIONS_ATTRIBUTION } from './config'
import { offsetPolyline } from './offset'

/** Width of one line in pixels; lines on a shared track are drawn this far apart. */
const LINE_WIDTH = 4
/** White outline around a line or a bundle of lines, in pixels per side. */
const CASING_WIDTH = 2

/** A track between two junctions and the lines on it, oriented along the first of them. */
interface TrackDrawing {
	readonly coordinates: readonly Coordinate[]
	readonly lines: readonly LineDefinition[]
}

const casingStyles = new Map<number, Style>()
function casingStyle (lineCount: number): Style {
	let style = casingStyles.get(lineCount)
	if (!style) {
		style = new Style({
			stroke: new Stroke({ color: MAP_COLORS.casing, width: lineCount * LINE_WIDTH + 2 * CASING_WIDTH, lineCap: 'round', lineJoin: 'round' }),
			zIndex: 0,
		})
		casingStyles.set(lineCount, style)
	}
	return style
}

/**
 * Lines that share a track are drawn side by side in a fixed order (the order of the line list), shifted
 * by whole line widths in screen pixels, so the offset depends on the resolution.
 */
function trackStyles (drawing: TrackDrawing, resolution: number): Style[] {
	const styles = [casingStyle(drawing.lines.length)]
	for (const [lane, line] of drawing.lines.entries()) {
		const offsetPixels = (lane - (drawing.lines.length - 1) / 2) * LINE_WIDTH
		styles.push(new Style({
			geometry: new LineString(offsetPolyline(drawing.coordinates, offsetPixels * resolution)),
			// Slightly wider than the lane, so that neighboring lanes leave no hairline gap.
			stroke: new Stroke({ color: line.color, width: LINE_WIDTH + 0.5, lineCap: 'round', lineJoin: 'round' }),
			zIndex: 1,
		}))
	}
	return styles
}

/** Groups the lines by network edge, each edge oriented along the first line that uses it. */
function trackDrawings (network: Network, lines: readonly ResolvedLine[]): TrackDrawing[] {
	const tracks = new Map<number, { coordinates: readonly Coordinate[], lines: LineDefinition[] }>()
	for (const line of lines) {
		for (const [index, edgeId] of line.path.edgeIds.entries()) {
			const track = tracks.get(edgeId)
			if (track) {
				track.lines.push(line.definition)
				continue
			}
			const edge = itemAt(network.edges, edgeId)
			const forward = edge.from === itemAt(line.path.nodeIds, index)
			tracks.set(edgeId, { coordinates: forward ? edge.coordinates : [...edge.coordinates].reverse(), lines: [line.definition] })
		}
	}
	return [...tracks.values()]
}

/** A layer with the colored lines; the badges at their ends are part of the place layer. */
export function createLineLayer (): { layer: VectorLayer, showLines: (network: Network, lines: readonly ResolvedLine[]) => void } {
	const source = new VectorSource({ attributions: SECTIONS_ATTRIBUTION })
	const layer = new VectorLayer({ source })

	function showLines (network: Network, lines: readonly ResolvedLine[]): void {
		source.clear()
		source.addFeatures(trackDrawings(network, lines).map(drawing => {
			const feature = new Feature(new LineString([...drawing.coordinates]))
			feature.setStyle((_, resolution) => trackStyles(drawing, resolution))
			return feature
		}))
	}

	return { layer, showLines }
}
