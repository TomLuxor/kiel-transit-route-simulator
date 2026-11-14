import type { Coordinate } from 'ol/coordinate'

export type LineId = '1' | '2' | '3' | '4'

/**
 * A planned Stadtbahn line. No public service publishes the lines, so they are defined here and laid onto
 * the WFS route sections: the line runs along the shortest path through the network between its waypoints.
 */
export interface LineDefinition {
	readonly id: LineId
	readonly name: string
	/** Route as described in the source (its "FH Kiel" is now called HAW Kiel). */
	readonly route: string
	/** Length in kilometers as stated in the source, for checking the computed path. */
	readonly officialLengthKm: number
	/** Longitude and latitude of the line ends (and of via points, should a path ever be ambiguous). */
	readonly waypoints: readonly Coordinate[]
	/** Line color on the map and in badges. */
	readonly color: string
	/** Text color on `color`, at least 4.5:1. */
	readonly onColor: string
}

/**
 * The four lines of the core network.
 *
 * Source: Landeshauptstadt Kiel, "Trassenstudie für ein zukunftssicheres ÖPNV-System auf eigener Trasse",
 * final report, October 2022, section 2.3 and figure 11. The waypoints are the free ends of the WFS route
 * sections at the termini named there.
 *
 * Colors: the hue families of figure 11 (line 1 blue, 2 brown-orange, 3 green, 4 violet), taken from the
 * KERN palette steps lightblue-450, orange-450, green-650 and violet-650. Checked on all pairs, because any
 * two lines can meet on a map: color-vision-deficiency separation ΔE 11.7 (target 8), normal vision ΔE 23.9
 * (floor 15), at least 3.5:1 against the white casing, and clearly apart from KERN's action blue and the
 * signal yellow. One step darker fails: orange and green merge for protanopes (ΔE 5.6).
 * Badge text: black on lines 1 and 2 (6.0:1), white on lines 3 and 4 (7.0:1).
 */
export const LINES: readonly LineDefinition[] = [
	{
		id: '1',
		name: 'Linie 1',
		route: 'HAW Kiel – Wellingdorf – Gaarden – Hauptbahnhof – Holtenauer Straße – CAU – Suchsdorf',
		officialLengthKm: 15.7,
		waypoints: [[10.1782, 54.3325], [10.0763, 54.3618]],
		color: '#0094be',
		onColor: '#000000',
	},
	{
		id: '2',
		name: 'Linie 2',
		route: 'Elmschenhagen – Preetzer Straße – Gaarden – Hauptbahnhof – Holtenauer Straße – Wik',
		officialLengthKm: 13.2,
		waypoints: [[10.1943, 54.2888], [10.1312, 54.3659]],
		color: '#c67600',
		onColor: '#000000',
	},
	{
		id: '3',
		name: 'Linie 3',
		route: 'Dietrichsdorf – Wellingdorf – Gaarden-Ost – Hauptbahnhof – Kronshagener Weg – Mettenhof',
		officialLengthKm: 15.6,
		waypoints: [[10.1951, 54.3364], [10.0491, 54.3162]],
		color: '#00681f',
		onColor: '#ffffff',
	},
	{
		id: '4',
		name: 'Linie 4',
		route: 'Berufsbildungszentrum Gaarden – Hauptbahnhof – Holtenauer Straße – CAU – Projensdorf',
		officialLengthKm: 9.5,
		waypoints: [[10.1620, 54.3051], [10.1133, 54.3564]],
		color: '#8a22b5',
		onColor: '#ffffff',
	},
]
