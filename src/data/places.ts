import type { Coordinate } from 'ol/coordinate'

/**
 * A named place on the network that keyboard and screen reader users can choose as start or destination.
 * Places are not stops (no public data has stop positions); they are line ends, branch points, section
 * boundaries and a few well-known places along the lines. Which lines serve a place is computed, not stored.
 */
export interface PlaceDefinition {
	readonly id: string
	readonly name: string
	/** Longitude and latitude; the place is moved onto the nearest line. */
	readonly coordinate: Coordinate
	/** Side of the name on the map, where the default (right) would cover a neighboring place. */
	readonly labelSide?: 'left'
}

/**
 * Coordinates: nodes of the network built from the WFS route sections, except for CAU (Audimax),
 * Alfons-Jonas-Platz and Kurt-Schumacher-Platz, which come from OpenStreetMap (© OpenStreetMap
 * contributors, ODbL). Names: the stop lists of the planning documents where a stop lies at the node,
 * otherwise the district, checked against OpenStreetMap. Ordered roughly north to south.
 */
export const PLACES: readonly PlaceDefinition[] = [
	{ id: 'wik', name: 'Wik', coordinate: [10.13122, 54.36585] },
	{ id: 'suchsdorf', name: 'Suchsdorf', coordinate: [10.07635, 54.36180] },
	{ id: 'projensdorf', name: 'Projensdorf', coordinate: [10.11331, 54.35637] },
	{ id: 'torfende', name: 'Torfende', coordinate: [10.10592, 54.35521] },
	{ id: 'bremerskamp', name: 'Bremerskamp', coordinate: [10.10510, 54.35088] },
	{ id: 'belvedere', name: 'Belvedere', coordinate: [10.13305, 54.34591] },
	{ id: 'cau', name: 'CAU (Audimax)', coordinate: [10.12376, 54.33824] },
	{ id: 'ansgarkirche', name: 'Ansgarkirche', coordinate: [10.13348, 54.33623] },
	{ id: 'dietrichsdorf', name: 'Dietrichsdorf', coordinate: [10.19515, 54.33638] },
	{ id: 'haw-kiel', name: 'HAW Kiel', coordinate: [10.17825, 54.33246] },
	{ id: 'dreiecksplatz', name: 'Dreiecksplatz', coordinate: [10.13411, 54.32834] },
	{ id: 'tiefe-allee', name: 'Tiefe Allee', coordinate: [10.19069, 54.32823] },
	{ id: 'hasseldieksdamm', name: 'Hasseldieksdamm', coordinate: [10.09584, 54.32818] },
	{ id: 'wellingdorf', name: 'Wellingdorf', coordinate: [10.19046, 54.32670] },
	{ id: 'kurt-schumacher-platz', name: 'Kurt-Schumacher-Platz', coordinate: [10.05192, 54.32179] },
	{ id: 'andreas-gayk-strasse', name: 'Andreas-Gayk-Straße / Ziegelteich', coordinate: [10.13312, 54.31811] },
	{ id: 'mettenhof', name: 'Mettenhof', coordinate: [10.04913, 54.31625] },
	{ id: 'alfons-jonas-platz', name: 'Alfons-Jonas-Platz', coordinate: [10.14811, 54.31371] },
	{ id: 'hauptbahnhof', name: 'Hauptbahnhof', coordinate: [10.12894, 54.31088], labelSide: 'left' },
	{ id: 'karlstal', name: 'Karlstal', coordinate: [10.14519, 54.31050] },
	{ id: 'am-langsee', name: 'Am Langsee', coordinate: [10.16133, 54.30487], labelSide: 'left' },
	{ id: 'sophienhoehe', name: 'Sophienhöhe', coordinate: [10.17056, 54.29751] },
	{ id: 'elmschenhagen', name: 'Elmschenhagen', coordinate: [10.19431, 54.28880] },
]
