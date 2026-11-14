# Project plan

Step-by-step plan for the Kiel Transit Route Simulator. Each step ends in a state that runs and passes `npm run lint` and `npm run build`, so it can be committed on its own.

## Assignment

- Find a public layer with the planned light rail (Stadtbahn) lines for Kiel.
- Show the different lines in different colors.
- Select two points, on the same line or on different lines.
- The map zooms to the starting point and moves along the line to the destination, changing lines if the route needs it.

## Decisions so far

- **OpenLayers instead of POLAR.** POLAR 3 is still an alpha release (`3.0.0-alpha.9`) and pins Node `^24.22.1`. OpenLayers gives direct control over the map view, which the ride animation depends on.
- **Data from the city of Kiel's geoservice** (ArcGIS Server, which offers both WFS 2.0 and WMS). The server sends `Access-Control-Allow-Origin: *`, so the browser can call it directly without a proxy.
- **WFS endpoint `LHKielWmsWfs`, layer `lhkiel:Trassenabschnitte`**, because it is the one named in the official metadata record and on the open data portal (CC BY 4.0), which makes it easy to cite.
- **The WFS delivers GeoJSON in EPSG:4326** with `outputFormat=GEOJSON&srsName=EPSG:4326`, which OpenLayers reads without extra projection libraries.

## What the data looks like

### Sources checked (14 November 2026)

| Source | What it has | Use |
| --- | --- | --- |
| [GDI-DE metadata record](https://www.geoportal.de/info/8ae2e3a0-23ff-4551-b71f-3dba6972cb4b) "Stadtbahn Kiel – Trassenabschnitte" (Stabsstelle Stadtbahn, 2025-10-07) | Official description of the route sections, license CC BY 4.0, points to the WFS `LHKielWmsWfs`, layer `lhkiel:Trassenabschnitte`. The same dataset is on opendata.schleswig-holstein.de. | **Main WFS** |
| `Stadtplan/Stadtbahn_IBS1` (WMS and WFS) | The same 16 route sections (layer `lhkiel:Stadtbahn_Trassenabschnitte`, coordinates identical to 1 mm), plus planning layers for the first stage: `IBS_*` road works and areas (October 2025), trees, the Ramboll alignment `IBS1_01_V3_Trasse_Ramboll`. | Alternative endpoint |
| `Stadtplan/Stadtbahn_WMS` (WMS and WFS, not listed in the service directory but public) | 240 layers: for each section AB01 to AB11 the alignment variants (V1, V2, …), road works, areas and trees. Variants, not the chosen network. | Optional WMS overlay |
| `Stadtplan/StadtplanKiel`, group "Stadtbahn Planung" | Section outlines as polygons (2023). | Not needed |
| [Final report of the route study](https://www.kiel.de/de/umwelt_verkehr/_dokumente_kiel_bewegt_sich/endbericht/kiel_oepnv_system_endbericht_trassenstudie_fuer_ein_zukunftssicheres_oepnv_system_auf_eigener_trasse.pdf) (October 2022), section 2.3, figure 11 | **The official line network:** four lines with routes and lengths. PDF only. | Line definitions |
| [Stadtbahn brochure 2025](https://www.kiel.de/de/umwelt_verkehr/_dokumente_kiel_bewegt_sich/kiel_stadtbahn_broschuere_2025.pdf), pages 12 and 13 | Network map with the first stage and "approximate stops". PDF only. | Stop positions (approximate) |
| [German Wikipedia: Stadtbahn Kiel](https://de.wikipedia.org/wiki/Stadtbahn_Kiel) | Stop sequence of every line (63 stops), taken from the planning documents. No coordinates. | Stop names and order |

Searched without further results: all 16 folders of the Kiel ArcGIS server, the GDI-DE catalogue (CSW), opendata.schleswig-holstein.de, ArcGIS Online. OpenStreetMap (Overpass) could not be reached during the research. **No public service has line geometries or stops, and nothing sits behind a login that a student could get.** The Stabsstelle Stadtbahn (stadtbahn@kiel.de, 0431 901-3077) may share stop positions on request.

### The route sections

- WFS `lhkiel:Trassenabschnitte`: 16 MultiLineString features (29 line parts), attributes `ogr_fid`, `Name` ("Abschnitt 1" to "Abschnitt 11"), `Länge` (text such as "3,5 km"), `Länge__m_` (number) and `Datum` (06.01.2025). The REST interface names the same fields `name`, `laenge`, `laenge_m`, `datum`; the WFS GeoJSON uses the names above.
- **Together they are 36.2 km: the complete core network of 35.8 km plus the depot access track.** The geometry is complete; only the line assignment and the stops are missing.
- Several sections consist of more than one feature: Abschnitt 2 has 3 (the trunk Hbf to Karlstal, the depot access, depot tracks), Abschnitt 5 has 2, Abschnitt 10 has 3 (two short turning tracks of 21 m and 106 m).
- The native coordinate system is EPSG:4647 (UTM zone 32N with zone prefix). The WMS offers CRS:84, EPSG:4326, EPSG:25832 and EPSG:4647, but **not EPSG:3857**, the default of OpenLayers.

### Topology

- Most sections meet exactly (under 1 m) at shared end points.
- One gap: the end of Abschnitt 6 at Ziegelteich lies about 50 m from the junction in Abschnitt 3. The snapping tolerance must be about 60 m.
- **Three branch points lie in the middle of a feature, not at its end:** Torfende (Abschnitt 8, Suchsdorf and Projensdorf branches), Tiefe Allee (Abschnitt 9, FH Kiel and Dietrichsdorf branches) and the turning track of line 4 in Abschnitt 10. The graph must split lines where another line's end point touches them, not only at end points.

### The line network (route study 2022, figure 11)

| Line | Route | Length | Sections used (my reading of figure 11, to check on the map) |
| --- | --- | --- | --- |
| 1 | FH Kiel (Neumühlen) – Wellingdorf – Gaarden – Hbf – Holtenauer Straße – CAU – Steenbeker Weg – Suchsdorf | 15.7 km | 9 (FH Kiel branch), 1, 2, 3, 4, 8 (Suchsdorf branch) |
| 2 | Elmschenhagen – Preetzer Straße – Gaarden – Hbf – Holtenauer Straße – Wik | 13.2 km | 11, 10, 2 (Hbf to Karlstal), 3, 4 (Dreiecksplatz to Ansgarkirche), 5 |
| 3 | Dietrichsdorf – Wellingdorf – Gaarden-Ost – Hbf – Kronshagener Weg – Mettenhof | 15.6 km | 9 (Dietrichsdorf branch), 1, 2, 3 (Hbf to Ziegelteich), 6, 7 |
| 4 (extra service) | Berufsbildungszentrum Gaarden – Hbf – Holtenauer Straße – CAU – Projensdorf | 9.5 km | 10 (to the turning track), 2 (Hbf to Karlstal), 3, 4, 8 (Projensdorf branch) |

The trunk from Hbf to Karlstal is shared by all four lines. Wikipedia names the termini slightly differently (line 1 to Rungholtplatz, line 2 to Isarweg, line 4 to Am Langsee); they are the same places.

## Step 0: Baseline (done)

- [x] Vue 3, TypeScript and Vite project (`create-vue --ts --bare`)
- [x] OpenLayers installed
- [x] ESLint 9 with `@dataport/eslint-config-geodev`, including Vue, HTML, JSON and Markdown; tabs everywhere
- [x] README with build and run instructions
- [x] Public repository on GitHub

## Step 1: Data model for the lines

Goal: a typed description of the lines that the rest of the application builds on.

- [x] Find the official line network: four lines, route study 2022 (see above).
- [x] Check whether any service already offers line geometries or stops: none does (see above).
- [x] Check the topology: one gap of about 50 m, three branch points in the middle of features (see above).
- [ ] Draw the 16 WFS features with their `ogr_fid` on the map and confirm the section table above.
- [ ] Write `src/data/lines.ts`. Because three lines branch in the middle of a feature, a line cannot be a list of whole features. Instead, define each line by its two termini and, where needed, a via point (`LineDefinition { id, name, color, stops: Coordinate[] }`), and let the routing graph from step 5 find the geometry between them. This keeps the official WFS as the only geometry source.
- [ ] Decide what a selectable "point" is. Recommended: the 63 stops, placed by hand on the WFS geometry from the brochure map and the Wikipedia stop lists, marked as approximate in the interface and the README. Fallback: any point on a line.
- [ ] Ask the lecturer early whether building the lines from the route sections is acceptable, since no public layer has the lines themselves. Optional: ask the Stabsstelle Stadtbahn for stop positions.

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
