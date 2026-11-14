import type { Coordinate } from 'ol/coordinate'

export type LineId = '1' | '2' | '3' | '4'

/**
 * A planned Stadtbahn line. No public service publishes the lines, so they are defined here and laid onto
 * the WFS route sections: the line runs along the shortest path through the network between its waypoints.
 */
export interface LineDefinition {
	readonly id: LineId
	readonly name: string
	/** Route as described in the source. */
	readonly route: string
	/** Length in kilometers as stated in the source, for checking the computed path. */
	readonly officialLengthKm: number
	/** Longitude and latitude of the line ends (and of via points, should a path ever be ambiguous). */
	readonly waypoints: readonly Coordinate[]
}

/**
 * The four lines of the core network.
 *
 * Source: Landeshauptstadt Kiel, "Trassenstudie für ein zukunftssicheres ÖPNV-System auf eigener Trasse",
 * final report, October 2022, section 2.3 and figure 11. The waypoints are the free ends of the WFS route
 * sections at the termini named there.
 */
export const LINES: readonly LineDefinition[] = [
	{
		id: '1',
		name: 'Line 1',
		route: 'FH Kiel – Wellingdorf – Gaarden – Hauptbahnhof – Holtenauer Straße – CAU – Suchsdorf',
		officialLengthKm: 15.7,
		waypoints: [[10.1782, 54.3325], [10.0763, 54.3618]],
	},
	{
		id: '2',
		name: 'Line 2',
		route: 'Elmschenhagen – Preetzer Straße – Gaarden – Hauptbahnhof – Holtenauer Straße – Wik',
		officialLengthKm: 13.2,
		waypoints: [[10.1943, 54.2888], [10.1312, 54.3659]],
	},
	{
		id: '3',
		name: 'Line 3',
		route: 'Dietrichsdorf – Wellingdorf – Gaarden-Ost – Hauptbahnhof – Kronshagener Weg – Mettenhof',
		officialLengthKm: 15.6,
		waypoints: [[10.1951, 54.3364], [10.0491, 54.3162]],
	},
	{
		id: '4',
		name: 'Line 4',
		route: 'Berufsbildungszentrum Gaarden – Hauptbahnhof – Holtenauer Straße – CAU – Projensdorf',
		officialLengthKm: 9.5,
		waypoints: [[10.1620, 54.3051], [10.1133, 54.3564]],
	},
]
