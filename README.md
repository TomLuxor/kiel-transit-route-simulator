# Kiel Transit Route Simulator

A web map application for the course *Geographical Web Applications* (HAW Kiel, winter semester 2026/27).

Kiel is planning a light rail system (Stadtbahn). This application shows the planned lines on a map, each line in its own color. You select two points on the network, on the same line or on different lines. The map then zooms to the starting point and moves along the line to the destination. If the route needs a change of line, it follows both lines and shows the transfer.

The page itself is in German and is called *Stadtbahn-Simulator Kiel*.

> **Status:** in development. The map shows the four planned lines in their own colors, side by side where they share a track, with a legend and the named places. Start and destination can be chosen with a click or tap on a line, or by keyboard in the route form, and dragged along the lines; a line chosen in the legend is ridden from end to end, and pointing at it shows it alone on the map. The app then finds the route with the fewest changes, shows it on the map and describes it in the side panel. The ride simulation zooms to the start and follows a vehicle along the route, stops at every change of line and announces departure, changes and arrival; it can be paused, stopped and run at three speeds, and with reduced motion it moves leg by leg without animation. The layout works on laptops and on phones in portrait and landscape; the accessibility audit follows. The step-by-step plan is in [PLAN.md](PLAN.md).

## How the route is found

1. **The way along the track.** Start and destination are located on the network built from the WFS route sections. Dijkstra's algorithm finds the shortest way between them along the track that the lines use.
2. **The lines along that way.** Starting at the start, the app rides the line that follows the way furthest, changes there to the line that goes furthest from that point, and so on. This gives the fewest changes, and each change happens where the previous line turns off.

The track the lines use has no loops (a tree, checked by a test), so there is only one way between two points and the two steps together give the best route. Because all four lines share the trunk from Andreas-Gayk-Straße via Hauptbahnhof to Karlstal, every route needs at most one change.

## Data sources

| Data | Source | Provider, license |
| --- | --- | --- |
| Background map | WMS basemap.de Web Raster, layer `de_basemapde_web_raster_grau` ([capabilities](https://sgx.geodatenzentrum.de/wms_basemapde?REQUEST=GetCapabilities&SERVICE=WMS)) | © GeoBasis-DE / BKG, CC BY 4.0 |
| Planned Stadtbahn route sections (geometry of the whole 35.8 km core network) | WFS, layer `lhkiel:Trassenabschnitte` ([capabilities](https://ims.kiel.de/geodatenextern/services/Stadtplan/LHKielWmsWfs/MapServer/WFSServer?service=WFS&request=GetCapabilities), [metadata](https://www.geoportal.de/info/8ae2e3a0-23ff-4551-b71f-3dba6972cb4b)) | © Landeshauptstadt Kiel, CC BY 4.0 |
| Stadtbahn planning layers (variants, road works, areas per section) | WMS ([capabilities](https://ims.kiel.de/geodatenextern/services/Stadtplan/Stadtbahn_WMS/MapServer/WMSServer?service=WMS&request=GetCapabilities)) | © Landeshauptstadt Kiel |
| Line network (which line runs on which sections) | *Trassenstudie für ein zukunftssicheres ÖPNV-System auf eigener Trasse*, final report, October 2022, section 2.3 ([PDF](https://www.kiel.de/de/umwelt_verkehr/_dokumente_kiel_bewegt_sich/endbericht/kiel_oepnv_system_endbericht_trassenstudie_fuer_ein_zukunftssicheres_oepnv_system_auf_eigener_trasse.pdf)) | Landeshauptstadt Kiel |

No public service publishes the lines themselves or the stops. The application therefore builds a network graph from the route sections and lays the four lines of the final report onto it; their computed lengths match the official ones within 1.6 %. Start and destination can be any point on a line, or one of 23 named places (line ends, branch points and well-known places, not stops). Three of the place coordinates (CAU, Alfons-Jonas-Platz, Kurt-Schumacher-Platz) come from [OpenStreetMap](https://www.openstreetmap.org/copyright) (© OpenStreetMap contributors, ODbL), and the place names were checked against it.

## Tech stack

- [Vue 3](https://vuejs.org/) with TypeScript, built with [Vite](https://vite.dev/)
- [OpenLayers](https://openlayers.org/) for the map
- [KERN UX-Standard](https://kern-ux.de) (`@kern-ux/native`) for colors, type, spacing and basic components
- [ESLint](https://eslint.org/) with the shared config [`@dataport/eslint-config-geodev`](https://github.com/Dataport/eslint-config-geodev)

## Design

The interface builds on KERN, the open UX standard for the German public administration initiated by Hamburg and Schleswig-Holstein, and adds its own transit layer on top:

- **From KERN:** colors, the typeface Fira Sans, spacing, the focus style, buttons, and the light and dark themes, which follow the system setting.
- **Own:** the logo, the line colors, the route display and the map controls, built on KERN's design tokens.
- **Two color rules:** KERN's action blue marks everything clickable. Signal yellow marks transit elements only, never something clickable, and always carries black text.
- **Not an official service:** this is a student project. It states so in the header and does not use KERN's official-website header bar, coats of arms or the KERN logo.

KERN's code is used unchanged under the [EUPL 1.2](https://interoperable-europe.ec.europa.eu/collection/eupl/eupl-text-eupl-12). Fira Sans is licensed under the [SIL Open Font License 1.1](https://openfontlicense.org) and is served by the application itself, not by an external font service.

## Prerequisites

- [Node.js](https://nodejs.org/) `^22.18.0` or `>=24.12.0` (includes npm)
- [Git](https://git-scm.com/)

## Getting started

```sh
git clone https://github.com/TomLuxor/kiel-transit-route-simulator.git
cd kiel-transit-route-simulator
npm install
npm run dev
```

Then open the address that Vite prints, by default <http://localhost:5173>.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the development server with hot reload |
| `npm run build` | Type-check and build for production into `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm test` | Run the unit tests once (Vitest) |
| `npm run test:watch` | Run the unit tests on every change |
| `npm run lint` | Check the code with ESLint |
| `npm run lint:fix` | Fix the ESLint findings that can be fixed automatically |
| `npm run type-check` | Check the types with `vue-tsc` |
