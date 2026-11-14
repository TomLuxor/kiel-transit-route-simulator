# Project plan

Step-by-step plan for the Kiel Light Rail Simulator. Each step ends in a state that runs and passes `npm run lint` and `npm run build`, so it can be committed on its own.

## Assignment

- Find a public layer with the planned light rail (Stadtbahn) lines for Kiel.
- Show the different lines in different colors.
- Select two points, on the same line or on different lines.
- The map zooms to the starting point and moves along the line to the destination, changing lines if the route needs it.

## Decisions so far

- **OpenLayers instead of POLAR.** POLAR 3 is still an alpha release (`3.0.0-alpha.9`) and pins Node `^24.22.1`. OpenLayers gives direct control over the map view, which the ride animation depends on.
- **Data from the city of Kiel's geoservice** (ArcGIS Server, which offers both WFS 2.0 and WMS). The server sends `Access-Control-Allow-Origin: *`, so the browser can call it directly without a proxy.
- **The WFS delivers GeoJSON in EPSG:4326** with `outputFormat=GEOJSON&srsName=EPSG:4326`, which OpenLayers reads without extra projection libraries.

## What the data looks like

- WFS layer `lhkiel:Stadtbahn_Trassenabschnitte`: 16 MultiLineString features with the attributes `name` ("Abschnitt 1" to "Abschnitt 11"), `laenge`, `laenge_m` and `datum` (January 2025). Some sections consist of several features: Abschnitt 2 has 3, Abschnitt 5 has 2, Abschnitt 10 has 3 (one of them only 14 m long).
- **The layer has no line attribute.** It describes route sections, not lines. The state government speaks of four lines and 35.8 km of track; line 1 is reported to run from the university of applied sciences via Gaarden, the main station and Holtenauer Straße to Suchsdorf. Step 1 has to establish which sections each line uses.
- The native coordinate system is EPSG:4647 (UTM zone 32N with zone prefix). The WMS offers CRS:84, EPSG:4326, EPSG:25832 and EPSG:4647, but **not EPSG:3857**, the default of OpenLayers.
- The same service has further planning layers: planning areas and road works (`IBS_*`, October 2025), trees, and an alignment by the planning firm Ramboll (`IBS1_01_V3_Trasse_Ramboll`).

## Step 0: Baseline (done)

- [x] Vue 3, TypeScript and Vite project (`create-vue --ts --bare`)
- [x] OpenLayers installed
- [x] ESLint 9 with `@dataport/eslint-config-geodev`, including Vue, HTML, JSON and Markdown; tabs everywhere
- [x] README with build and run instructions
- [x] Public repository on GitHub

## Step 1: Data model for the lines

Goal: a typed description of the lines that the rest of the application builds on.

- [ ] Find the official line network (kiel.de/stadtbahn, council documents, the presentations of the preferred route): which sections belong to which line, and the line names or numbers.
- [ ] Check whether any service already offers line geometries or stops (Kiel geoportal, `IBS1_01_V3_Trasse_Ramboll`, opendata.schleswig-holstein.de). If so, use it directly.
- [ ] Otherwise write `src/data/lines.ts`: an interface such as `LineDefinition { id, name, color, sectionIds }` that maps each line to the WFS features (`ogr_fid`). Cite the source in the README.
- [ ] Check the topology: do the sections meet exactly at their ends, or are there gaps? This sets the snapping tolerance in step 5.
- [ ] Decide what a selectable "point" is: stops (if data exists), section ends and junctions, or any point on a line.
- [ ] If it stays unclear whether sections may stand in for lines, ask the lecturer early.

## Step 2: Map with WMS and WFS

- [ ] `MapView.vue`: create the OpenLayers `Map` in `onMounted`, remove it in `onBeforeUnmount`, import `ol/ol.css`.
- [ ] Center the view on Kiel (about 10.13° E, 54.32° N).
- [ ] Background map from a WMS, for example the basemap.de WMS of the BKG or the city map WMS of Kiel. Check which coordinate systems it offers. If EPSG:3857 is missing, either let OpenLayers reproject the image (`projection: 'EPSG:4326'` on the source) or switch the view to EPSG:25832 with proj4.
- [ ] Optional: the Stadtbahn WMS as an extra layer that can be switched on and off (for example the planning areas).
- [ ] WFS: a `VectorSource` with the `GeoJSON` format that loads `lhkiel:Stadtbahn_Trassenabschnitte`. Describe the feature properties with an interface and check them with type guards on `unknown`, without `any`.
- [ ] Attributions for all sources (BKG or OpenStreetMap, Landeshauptstadt Kiel).
- [ ] Loading and error states in the interface, for when a service is slow or down.

## Step 3: Lines in colors, with a legend

- [ ] Style function that colors each line according to `lines.ts`.
- [ ] Sections shared by several lines: draw parallel offset strokes or stacked widths so that every line stays visible.
- [ ] Colors that color-blind users can tell apart, with at least 3:1 contrast against the background map (WCAG 1.4.11).
- [ ] Never color alone: a legend with line names, and labels on the map.
- [ ] The legend is an HTML list next to the map, so screen readers can read it, not something drawn into the map canvas.

## Step 4: Selecting start and destination

- [ ] Mouse and touch: a click on the map snaps to the nearest point on a line (`getClosestFeatureToCoordinate` and `getClosestPoint`) within a pixel tolerance. Clicks far from every line are ignored with a short hint.
- [ ] Keyboard and screen reader: a form with two `<select>` elements (start and destination) grouped by line, with `<label>` elements, a swap button and a "Start ride" button. The map click and the form stay in sync.
- [ ] Markers for start and destination; start and destination must differ.

## Step 5: Routing over the network

Pure TypeScript in `src/routing/`, independent of Vue and the map, so it can be tested on its own.

- [ ] Build a graph from the line geometries: nodes at line ends and wherever lines meet (snapped with the tolerance from step 1); edges carry the line ID, the length (`getLength` from `ol/sphere`) and the coordinates.
- [ ] Insert start and destination into the graph by splitting the edge they lie on.
- [ ] Dijkstra over (node, line) pairs with a penalty for every change of line, so that routes with fewer changes win.
- [ ] Result: a list of legs `{ lineId, coordinates, lengthMeters }` and the transfer points.
- [ ] Recommended: add Vitest and test the cases same line, one change, two changes, and start on a junction.

## Step 6: Simulating the ride

- [ ] Zoom to the start with `view.animate({ center, zoom, duration })`.
- [ ] Follow the route at constant speed: a `requestAnimationFrame` loop computes the position from the distance travelled (`LineString.getCoordinateAt`) and calls `view.setCenter`. Optionally rotate the view to the direction of travel.
- [ ] A vehicle marker, and the part already travelled highlighted. At a transfer, a short stop and the message "Change from line X to line Y".
- [ ] Controls for pause and resume, stop, and speed (good practice, see WCAG 2.2.2).
- [ ] With `prefers-reduced-motion`, jump leg by leg instead of moving continuously (WCAG 2.3.3).
- [ ] A status region with `aria-live="polite"` that announces start, transfers and arrival.
- [ ] Decide what happens when the user drags the map during a ride: block map interactions, or stop the ride.

## Step 7: Layout and responsive design

- [ ] Semantic structure: `header`, `main`, `aside` for controls and legend, `footer` for sources.
- [ ] CSS grid: map with a side panel on a laptop and on a phone in landscape; the panel below the map on a phone in portrait (media queries on width and orientation, `dvh` units).
- [ ] Prefer CSS over JavaScript, for example `<details>` for a collapsible panel. The map itself needs `map.updateSize()` from a `ResizeObserver`, one place where JavaScript is unavoidable.
- [ ] Test on a phone in portrait and landscape and on a laptop (a real phone and the DevTools device mode).

## Step 8: Accessibility

- [ ] Keyboard: everything reachable with Tab, a visible `:focus-visible` style, a logical order. The map element is focusable (`tabindex="0"` and an `aria-label`) so that the OpenLayers keyboard pan and zoom work.
- [ ] Screen reader test with NVDA on Windows and with TalkBack or VoiceOver on the phone.
- [ ] Lighthouse accessibility score of 100 % on desktop and mobile. If it cannot be reached, explain why in the README.
- [ ] Contrast of text (4.5:1) and of interface components (3:1).

## Step 9: Finishing and submission

- [ ] `npm run lint` and `npm run build` without findings. Optional: a GitHub Actions workflow that runs both on every push.
- [ ] Optional: deploy to GitHub Pages (set `base` in `vite.config.ts`) for an easy live demo.
- [ ] README: final feature list, data sources and licenses, Lighthouse result, build and run instructions.
- [ ] Upload the repository link to Moodle.
- [ ] Slides for 15 minutes: topic, data source, architecture, live demo, requirements checklist, accessibility results, lessons learned. Rehearse with a timer and upload the slides to Moodle.
- [ ] Prepare for questions: WMS versus WFS, coordinate systems (EPSG:4647, 25832, 3857), the routing algorithm, the animation, the accessibility choices.

## Requirements checklist

| Requirement | Where | Status |
| --- | --- | --- |
| HTML: semantic tags, tabs, consistent self-closing tags | templates and `index.html`, checked by ESLint | set up |
| CSS: responsive, tested on phone (portrait, landscape) and laptop | step 7 | open |
| CSS preferred over JavaScript | step 7 | open |
| Typed TypeScript, no `any` | strict `tsconfig`, `typescript-eslint` strict type-checked rules | set up |
| Git, public on GitHub | this repository | done |
| ESLint `@dataport/eslint-config-geodev` | `eslint.config.ts` | done |
| Vue.js | Vue 3 | done |
| At least one WMS and one WFS | step 2 | open |
| OpenLayers or POLAR | OpenLayers 10 | installed |
| WCAG, keyboard, screen reader, Lighthouse 100 % | steps 4, 6 and 8 | open |
| README with topic, build and run instructions | `README.md` | started |
| 15-minute presentation, slides on Moodle | step 9 | open |
