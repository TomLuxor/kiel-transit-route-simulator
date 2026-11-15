# Kiel Transit Route Simulator

A web map application for the course *Geographical Web Applications* (HAW Kiel, winter semester 2026/27).

Kiel is planning a light rail system (Stadtbahn). This application shows the planned lines on a map, each line in its own color. You select two points on the network, on the same line or on different lines. The map then zooms to the starting point and moves along the line to the destination. If the route needs a change of line, it follows both lines and shows the transfer.

The page itself is in German and is called *Stadtbahn-Simulator Kiel*.

**Live:** <https://tomluxor.github.io/kiel-transit-route-simulator/>, published from `main` by GitHub Actions (see [Deployment](#deployment)). The step-by-step plan and the decisions behind it are in [PLAN.md](PLAN.md).

## Features

- **The planned network:** the four lines of the route study in their own colors, side by side where they share a track, with their numbers at both ends and 23 named places along them. A button below the zoom buttons shows the whole network again.
- **Start and destination:** a click or tap on a line, or a choice from two lists in the side panel, which also work by keyboard and screen reader. Both can be swapped and dragged along the lines. A hint on the map says what the next click sets.
- **The line list:** pointing at a line or focusing it washes out the other lines on the map; choosing it sets start and destination at its two ends, so it can be ridden from end to end.
- **The route:** the one with the fewest changes, drawn on the map in the colors of its lines and described leg by leg in the side panel.
- **The ride:** the map zooms to the start and follows a vehicle along the route. It stops at every change, and the part already travelled turns grey. The ride can be paused, stopped and run at three speeds; dragging the map pauses it, so you can look around. Departure, changes and arrival are announced to screen readers. With reduced motion, it shows one leg at a time without animation.
- **When a service fails:** a message on the map says so and offers to try again. The Stadtbahn data counts as failed after 15 seconds without an answer; without the background map, lines and routes keep working.
- **Everywhere:** laptops and phones in portrait and landscape, a light and a dark theme that follow the system setting, the whole interface in German.

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
- **Not an official service:** this is a student project. The header says so ("Studentisches Projekt", on small screens behind an info button next to the title), and the app does not use KERN's official-website header bar, coats of arms or the KERN logo.

KERN's code is used unchanged under the [EUPL 1.2](https://interoperable-europe.ec.europa.eu/collection/eupl/eupl-text-eupl-12). Fira Sans is licensed under the [SIL Open Font License 1.1](https://openfontlicense.org) and is served by the application itself, not by an external font service.

## Accessibility

The application aims at WCAG 2.2 level AA.

- **Keyboard:** everything can be reached with Tab in a logical order, with a visible focus outline. The map takes the focus too: it moves with the arrow keys and zooms with + and −. Start and destination are chosen in the form, the ride is started, paused and stopped with its buttons, the speed with the arrow keys.
- **Screen readers:** the page has landmarks and headings and is marked as German (`lang="de"`). What happens on the map is announced in status regions: a chosen point and where it lies, a new route in one sentence, and departure, changes and arrival during the ride. The route is also a list in the side panel.
- **Not by color alone:** every line carries its number on the map and in the line list. Start and destination are pins in different colors with different dots.
- **Motion:** with `prefers-reduced-motion`, the map does not glide; the ride shows one leg at a time and moves on every 3 seconds (WCAG 2.3.3).
- **Dragging:** dragging the pins is an extra; a click or the form does the same (WCAG 2.5.7).

### Results

Lighthouse 13.6 on the live site, 15 November 2026:

| | Performance | Accessibility | Best practices | SEO |
| --- | --- | --- | --- | --- |
| Mobile | 97 | 100 | 100 | 100 |
| Desktop | 100 | 100 | 100 | 100 |

Lighthouse only checks the page after loading. So [axe-core](https://github.com/dequelabs/axe-core), the engine behind its accessibility audits, also ran in 19 other states (start chosen, route shown, ride running, paused and arrived, a line highlighted, loading error; light and dark; laptop, phone in portrait and in landscape) with the WCAG 2.2 A/AA and best-practice rules: no violations. Contrast was measured on its own, including the map, which neither tool can see: text at least 6.4:1, borders of form fields and buttons at least 4.5:1, lines against their white casing at least 3.5:1, line numbers at least 6:1, pins at least 14:1. The layout was checked in Chrome's device emulation at 1920 × 1080, 1280 × 800, 390 × 844 and 844 × 390 pixels, and at the smaller sizes a phone leaves with its browser bar shown (390 × 664 in portrait, 844 × 340 and 780 × 304 in landscape).

To measure it yourself, use the production build, not the development server, whose unminified code and hot reload lower the performance score:

```sh
npm run build
npm run preview
```

Then run Lighthouse from Chrome's DevTools on <http://localhost:4173/>, or on the live site.

### Contrast below 3:1 on purpose

In two states, the map draws lines with less than the 3:1 contrast that WCAG 1.4.11 asks of graphics needed to understand the content:

- While a line in the line list is pointed at or focused, the other lines are washed out (1.4 to 1.7:1).
- While a route is shown, the rest of the network is dimmed behind it.

Both are context, not content. They point out the line or the route that matters at that moment, and that line or route keeps its full contrast. The washed-out lines come back as soon as the pointer or the focus leaves that line in the list, and every line is also named there.

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

## Deployment

The workflow [`.github/workflows/pages.yml`](.github/workflows/pages.yml) runs lint, tests and the build on every push and pull request. On a push to `main` it then publishes the build on GitHub Pages (repository settings: *Pages*, source *GitHub Actions*). The build uses relative paths (`base: './'` in `vite.config.ts`), so the same `dist/` works in the Pages subfolder and at the root with `npm run preview`.
