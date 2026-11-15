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
- **The page is in German** (`lang="de"`), for the people of Kiel the Stadtbahn is planned for; screen readers then pronounce it correctly. Its name is "Stadtbahn-Simulator Kiel". Code, comments and these documents stay in English.
- **Design: KERN as the foundation, with an own transit layer.** KERN (`@kern-ux/native`, plain CSS classes in our own semantic markup, not the community Vue kit) provides colors, Fira Sans, spacing, focus style, buttons and the light and dark themes. Our own: logo, line colors and badges, route display, map controls on KERN tokens. KERN's action blue means clickable; signal yellow (`--app-color-signal`) means transit and always carries black text. No official-website header bar, coats of arms or KERN logo, and a "student project" note in the header, so the app cannot pass as an official service of the city.

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

| Line | Route | Length | Sections used (figure 11, checked on the map) |
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
- [x] Decide what a selectable "point" is: the assignment asks for "two points", not stops. Mouse and touch users click anywhere on a line; keyboard and screen reader users choose from named places that the network itself provides: the line ends, the branch points and the section boundaries (about 15 to 20, for example Hauptbahnhof, Karlstal, Wellingdorf). Stops are an optional extra.
- [x] Asked the Stabsstelle Stadtbahn for stop positions and the current line network (email sent 14 November 2026). If stops arrive, add them as extra selectable points.

Done after step 2, because the map is the tool for checking the data:

- [x] Draw the 16 WFS features with their `Name` and `ogr_fid` on the map and confirm the section table above (labels show in development mode only).
- [x] Build the network graph from the sections (`src/network/graph.ts`): split every line part where another part's end touches it, join ends within 60 m, nodes at ends and junctions, edges with length and coordinates. Result: 27 nodes, 27 edges. This is the first half of step 5, moved forward.
- [x] Write `src/data/lines.ts`: each line defined by its two ends (`waypoints`); `src/network/lines.ts` lays it onto the graph as the shortest path between them. Computed lengths: line 1 15.67 km (official 15.7), line 2 13.16 km (13.2), line 3 15.55 km (15.6), line 4 9.65 km (9.5). The colors follow in step 3.
- [x] Write `src/data/places.ts`: 23 named places (line ends, branch points, section boundaries, CAU, Alfons-Jonas-Platz, Kurt-Schumacher-Platz). Names checked against the stop lists and OpenStreetMap; `src/network/places.ts` moves each onto the nearest line and computes which lines serve it.
- [x] Unit tests with Vitest (`npm test`) on a snapshot of the WFS: the line lengths, the shared trunk from Andreas-Gayk-Straße to Karlstal, no depot track in any line, no shortcuts off the track, and the lines serving each place.

## Step 2: Map with WMS and WFS

- [x] `MapView.vue`: create the OpenLayers `Map` in `onMounted`, remove it in `onBeforeUnmount`, import `ol/ol.css`. The map element is focusable and labelled, so the OpenLayers keyboard pan and zoom work.
- [x] Center the view on Kiel; once the sections are loaded, fit the view to the network.
- [x] Background map from the basemap.de WMS of the BKG (`de_basemapde_web_raster_grau`, grey so that the lines stand out). It offers EPSG:3857, so no reprojection is needed. Loaded as `TileWMS`, so tiles are cached while the ride animation moves the map.
- [ ] Optional: the Stadtbahn WMS as an extra layer that can be switched on and off (for example the planning areas).
- [x] WFS: `src/network/sections.ts` fetches `lhkiel:Trassenabschnitte` as GeoJSON and checks every feature with type guards on `unknown` into a typed `Section`. `useSections` keeps the sections in a `shallowRef`, so OpenLayers geometries are not wrapped in deep reactive proxies.
- [x] Attributions for both sources, always expanded (both licenses are CC BY 4.0 and require them).
- [x] Loading and error states: a status line (`role="status"`) and a "Try again" button.

## Step 3: Lines in colors, with a legend

- [x] Style function that colors each line according to `lines.ts` (`src/map/lineLayer.ts`); the temporary section layer is gone.
- [x] Shared tracks: the lines are drawn side by side in 4 px lanes inside one white casing (`src/map/offset.ts`, miter offsets in screen pixels), in the order of the line list. Lines 2 and 3 swap sides inside the Karlstal junction; no fixed order avoids every crossing on this network.
- [x] Colors: the hue families of the route study's figure 11, from the KERN palette (lightblue-450, orange-450, green-650, violet-650). Checked with the dataviz palette validator on all pairs: CVD ΔE 11.7 (target 8), normal vision ΔE 23.9 (floor 15), at least 3.5:1 against the white casing. The casing keeps the same colors valid in dark mode. The next darker steps fail (orange and green merge for protanopes).
- [x] Never color alone: line number badges at both ends of every line on the map (black text on lines 1 and 2 at 6.0:1, white on 3 and 4 at 7.0:1), and the legend.
- [x] The legend is an HTML list in a side panel (`LineLegend.vue`, `LineBadge.vue`): next to the map on laptops and phones in landscape, below it in portrait. The badge keeps an outline in Windows high contrast mode.
- [x] Check: the lines use 34.5 km of track, the official operated network is 34.7 km (unit test).

## Step 4: Selecting start and destination

- [x] Mouse and touch: a click snaps to the nearest point on a line within 20 px, or to a named place within 12 px of its dot (`src/network/routePoints.ts`). A point is named after the nearest place on its line, for example "Punkt auf Linie 2, 1,1 km von Wik entfernt", so the form and screen readers can say where it is. Clicks far from every line are ignored with a hint. Over a line, the pointer changes. The closest-point search compares planar distances, because it runs on every pointer move.
- [x] Keyboard and screen reader: `RouteForm.vue`, a `<form>` with two labelled KERN selects, a swap button and a radio group "Ein Klick in die Karte wählt: Start / Ziel". After the first choice, the map click moves on to the empty endpoint, so two clicks choose start and destination. The places are listed alphabetically with their lines ("Hauptbahnhof (alle Linien)") instead of grouped by line: grouping would list a place up to four times, and an alphabetical list lets the keyboard jump by first letter. A clicked point appears as an extra option. Map click and form share one state (`useRouteSelection`).
- [x] Start and destination must differ: the other endpoint's place is disabled in each list, and a choice closer than 50 m to the other endpoint is refused with a message. Results of map clicks and refusals are announced in a `role="status"` region.
- [x] Markers as in the logo: the start a filled dark disc, the destination a signal-yellow disc in a dark ring, on their own canvas above everything. The form labels show the same markers, so they double as their legend. A point chosen in the form that is outside the view is panned into view (no animation with `prefers-reduced-motion`).
- [x] The named places on the map: station dots with their names; where a line ends, its badge marks the place. Names that would overlap are left out until the map is zoomed in, the busiest places first; badges and dots are never covered. Hauptbahnhof and Am Langsee have their name on the left.
- [x] Found on the way: KERN defines its `-contextual` tokens only inside its layer containers, so the app's focus outline (built on one) was invalid and invisible. It now uses `--kern-color-action-focus-default`. KERN also outlines elements with a `tabindex` after a mouse click and not for keyboard focus; the app reverses that. The map's outline is drawn on an overlay, because the OpenLayers viewport covers the map element's own outline.
- The "Start ride" button moves to step 6, where it gets something to do.

## Step 5: Routing over the network

Pure TypeScript in `src/routing/`, independent of Vue and the map, so it can be tested on its own.

- [x] The line IDs per edge come from the line paths of step 1 (an edge on the trunk carries all four lines).
- [x] Simpler than planned, in two steps (`src/routing/route.ts`). First the way along the track: start and destination are located on their edges, and the shortest way leaves the start's edge at either end, follows Dijkstra's shortest path, and enters the destination's edge at either end (or stays on the edge if both lie on it). Then the lines along that way, greedily: ride the line that follows the way furthest, change there to the line that goes furthest from that point, and so on. The planned Dijkstra over (node, line) pairs with a change penalty is not needed, because the track the lines use is a tree (23 nodes, 22 edges, checked by a test): there is only one way between two points, and along a fixed way the greedy choice gives the fewest changes. It also places each change where the first line turns off (Suchsdorf to Elmschenhagen changes at Karlstal, not at Ansgarkirche), which a penalty alone would leave to chance.
- [x] Result: legs `{ lineId, coordinates, lengthMeters }`; the changes are where the legs meet. `src/routing/describe.ts` names them: the place at a change, "vom Startpunkt" and "bis zum Zielpunkt" for points chosen on the map (their long names already stand in the form), and a summary such as "12,2 km, 1 Umstieg".
- [x] Tests: same line, one change (Wik to Mettenhof at Andreas-Gayk-Straße), the change where the first line turns off, a start on a junction, a start between places, no gaps and the same length in both directions, every one of the 506 pairs of places with at most one change, and the German description. The Kiel network never needs two changes, because all lines share the trunk, so a small test network checks two changes and that a longer line saves one.
- [x] Shown right away, not only in step 6: the route in the colors of its lines, twice as wide, over the dimmed network, with white change markers, and the view fitted to the route. In the panel, `RouteSummary.vue` lists the legs ("Umstieg in Linie 3") and a `role="status"` region announces each new route in one sentence.
- [x] The whole page is in German (`lang="de"`), including the error messages that can reach the status line, the map controls and German number formats ("34,5 km").
- [x] Found on the way: KERN takes any button that contains `kern-sr-only` for an icon-only button and fixes its width at 40 px, which cut off the swap button. Buttons with a visible label use the app's own `app-visually-hidden` instead. Fitting the view now adds the height of the attributions at the bottom, which cover three lines on phones.

## Step 6: Simulating the ride

- [x] The ride model is pure TypeScript (`src/routing/ride.ts`): a state (leg, meters on the leg, time left to wait) that `advanceRide` moves on by the time elapsed, and `ridePosition` for the vehicle's coordinate and the way travelled. The distances along a leg are measured on the ground once per leg, so the timing matches the route length in meters; `LineString.getCoordinateAt` would measure in map units instead.
- [x] `useRide` runs it in a `requestAnimationFrame` loop: start, pause, resume, stop, and a speed that can change during the ride. A frame counts at most 100 ms, so the vehicle does not jump after the tab was in the background.
- [x] Controls in `RideControls.vue`, right below the route summary so they are in view without scrolling the panel on a laptop: one button that changes from "Fahrt starten" to "Anhalten", "Weiter" and "Noch einmal fahren", so keyboard focus stays on it; "Beenden", which hands focus back to that button; a progress bar ("Gefahren: 5,6 km von 12,2 km"); and the speed (Langsam, Normal, Schnell: 150, 300 and 600 m/s, about 25, 50 and 100 times as fast as a tram). Not the form's submit button as planned: the ride belongs to the route, not to the choice of start and destination.
- [x] The map waits 1.5 s at the start while it zooms there (zoom 15), then follows the vehicle with `view.setCenter`. The view does not rotate with the direction of travel: a turning map is hard to follow and confuses the north arrow.
- [x] The vehicle: the front of a tram on a disc in the line color. The part already travelled turns grey (KERN neutral-450), as in navigation apps, instead of being highlighted as planned: the way ahead keeps the colors of its lines, so the next line is visible. At a change, a stop of 1.5 s, and the vehicle takes the new line's color.
- [x] With `prefers-reduced-motion`, the view shows one leg at a time without animation, the vehicle at its start, and jumps to the next leg after 3 s (WCAG 2.3.3).
- [x] A status region announces the departure ("Abfahrt: Wik, mit Linie 2."), every change ("Andreas-Gayk-Straße / Ziegelteich: Umstieg in Linie 3."), the arrival ("Angekommen: Mettenhof.") and pauses.
- [x] Dragging the map pauses the ride ("Fahrt angehalten, weil die Karte verschoben wurde."), so the user can look around and the view does not jump back; zooming during the ride is allowed. A click on the map does not choose points during a ride, and a new start or destination ends the ride.
- [x] Tests: speed and departure wait, the arrival time from distance and stops, the stop at the change, the vehicle stays on the route and never goes backwards, the way travelled is as long as the distance travelled, reduced motion never stops between the ends of a leg, and `useRide` with a fake animation clock (announcements, pause and resume, a new route ends the ride).
- [x] Found on the way: the test TypeScript project had no DOM types (`"lib": []` from the project template), which the tests of browser code now need. KERN's progress bar also reads `-contextual` tokens, mapped to the global ones like the focus outline.
- On a phone in portrait the ride controls are below the map and need scrolling; that is part of step 7.

## Step 7: Layout and responsive design

- [x] Semantic structure: `header`, `main`, an `aside` with the form, the route and the legend as labelled sections. No `footer` for the sources: they stay in the map, where CC BY and the BKG's source note ask for them, and the Stadtbahn credit is now as short as the WFS words it ("Landeshauptstadt Kiel, Lizenz CC-BY-4.0"), one line on a laptop.
- [x] CSS grid: map with a side panel on a laptop and on a phone in landscape (`clamp(18rem, 34vw, 24rem)`, wide enough for two buttons side by side); the panel below the map on a phone in portrait (at most 40 % of the height, `dvh`). OpenLayers 10 follows the size changes by itself.
- [x] The status bar shows only while loading or after an error. Once loaded, its message stays in the page for screen readers ("Stadtbahnnetz geladen …") but takes no space: 44 px more map.
- [x] The ride controls are a bar at the bottom of the side panel (`position: sticky`), so "Fahrt starten" and "Anhalten" are always reachable, on phones too; the speed is a list, so the bar stays low.
- [x] During a ride on a phone (narrower than 48rem, or lower than 37.5rem), the panel shows only the leg the vehicle is on and the ride bar; the form, the legend and the summary come back when the ride stops or arrives. Pure CSS: a class on the panel and a media query. The current leg is marked with `aria-current="step"` on every screen.
- [x] A point chosen on the map is "Punkt auf Linie 2" in the list; where it lies ("1,1 km von Wik entfernt") stands in a box above its marker. Screen readers still hear the full description when the point is chosen. Also fixed: "Punkt auf allen Linien" (dative).
- [x] The choice of what a map click sets is one row ("Kartenklick wählt: Start / Ziel").
- [x] A button below the zoom buttons shows the whole network again, for example after a ride.
- [x] Checked in Chrome's device emulation at 1920 × 1080, 1280 × 800, 390 × 844 (phone portrait) and 844 × 390 (phone landscape), light and dark.
- [x] Shorter texts: one line on how to use the app ("Start und Ziel in der Karte auf eine Linie setzen, dann die Fahrt starten.") instead of the heading "Start und Ziel" and its intro; that heading stays for screen readers only. No heading "Verbindung" and no placeholder before a route exists: the route list just appears, and a hidden live region still announces it in one sentence. The lists say "Halt wählen".
- [x] Start and destination can be dragged along the lines with the mouse or a finger. The marker slides along the nearest line, snaps to a place when it passes over its dot, and stops 50 m before the other endpoint. The route on the map follows while dragging; the form, the list and the announcement update once, on drop, and the view stays where it is. Dragging is an extra: clicking and the form do the same without dragging (WCAG 2.5.7).
- [x] Fixed: the map panned and zoomed with the mouse wheel only once it had the focus (OpenLayers' default for a map with a `tabindex`). It now reacts at once.
- [x] One type scale for the side panel: the section title "Linien" 18 px semi-bold; field labels and list entries 16 px semi-bold; text and secondary settings ("Kartenklick wählt", "Tempo") 16 px regular; details, distances and messages 14 px, details muted. Before, labels, settings and the section title were all 18 px semi-bold and larger than the list entries.
- [x] Ride bar: the first row is the same in every state, the main button (it takes the space left) and the speed. "Beenden" moved next to the distance travelled; after the arrival the main button says "Fahrt starten" again ("Noch einmal fahren" was too wide). The panel is 26rem wide on laptops, so the row fits next to a Windows scrollbar; in a narrower panel (a phone in landscape) the button spans the row and the speed sits below it.
- [x] The start marker sits on the same white halo as the destination, so on a place it covers the station dot or line badge instead of showing its rim.
- [x] The line legend is KERN's accordion (`details`), open at first. Pointing at a line or focusing it with the keyboard washes out the other lines and their badges on the map; a click sets start and destination at its two ends in the direction of its route, and the line whose ends are start and destination is marked (`aria-current`). Not a second sidebar: the accordion works the same on phones and laptops without a further layout.
- [x] Pointing at a line is a preview of choosing it: with a route chosen, the route and its markers step back to 40 % while the line is pointed at, and come back when it is left; the chosen line itself changes nothing, and during a ride the route and the vehicle stay as they are. The line list starts closed on phones (the screens of the ride mode), where the panel has little room and the lines are on the map anyway.
- [x] Lines in the panel follow the features: the ride bar belongs to the route block and has no line of its own in its place; it shows one only while it is stuck at the bottom, floating over the content below (a CSS scroll-state query; browsers without it keep the line). The line list, a feature of its own, has a line across the full width. The main button keeps its own width, aligned with the fields; the speed sits beside it (24 px apart), so the two read as one group. The button is as wide as its longest label in every state, so the speed does not jump when "Fahrt starten" turns into "Anhalten" or "Weiter".
- [x] Start and destination are pins (black with a white dot, signal yellow with a black dot), the only shape on the map that is not round, so they stand out from places, changes, badges and the vehicle; the form shows the same pins as their legend. The speed list has no visible label any more ("Langsam", "Normal", "Schnell" speak for themselves); screen readers still hear "Tempo".
- [x] A station with the start or destination pin on it changes a little: when the pin lands, its dot or line badge pops (swells for about 150 ms, then settles in 300 ms at 1.3 or 1.1 times its size) and its name turns bold, also while a dragged pin snaps onto it; when the pin leaves, it shrinks back. No endless pulsing, which would distract and need a pause control (WCAG 2.2.2); with reduced motion the size changes without animation. While it pops, the dot is no declutter obstacle, so no name blinks out; the name sits as far out as the dot has grown. A pin dragged by its head keeps the distance from the pointer to its tip, so it no longer jumps up to the pointer.
- [x] Messages that confirm what the user just did or what the page shows anyway ("Start und Ziel getauscht.", "Fahrt beendet.", departure, changes, arrival) are read out but not shown. Shown are only those that tell what nothing else on the page does: a refused choice, a click beside the lines, and a pause the user did not ask for ("… weil die Karte verschoben wurde"). A valid choice removes a refusal.
- [x] The side panel always has its scrollbar (where the system shows one), in KERN's colors, so closing the line list no longer moves the panel sideways.
- Decided: the route form stays above the line list. Choosing start and destination is the main task, it is what a phone shows first, the form, the route and the ride bar read as one flow from top to bottom, and keyboard users reach the form first. The map itself shows the lines with their colors and badges.
- [ ] Test on a real phone in portrait and landscape.

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
| CSS: responsive, tested on phone (portrait, landscape) and laptop | step 7; device emulation done, real phone open | started |
| CSS preferred over JavaScript | step 7: layouts, ride mode, sticky ride bar and hidden status bar in CSS | done |
| Typed TypeScript, no `any` | strict `tsconfig`, `typescript-eslint` strict type-checked rules | set up |
| Git, public on GitHub | this repository | done |
| ESLint `@dataport/eslint-config-geodev` | `eslint.config.ts` | done |
| Vue.js | Vue 3 | done |
| At least one WMS and one WFS | basemap.de WMS, Kiel WFS (step 2) | done |
| OpenLayers or POLAR | OpenLayers 10 | installed |
| WCAG, keyboard, screen reader, Lighthouse 100 % | steps 4, 6 and 8; route selection, route description and ride by keyboard and screen reader done, reduced motion, page language German | started |
| README with topic, build and run instructions | `README.md` | started |
| 15-minute presentation, slides on Moodle | step 9 | open |
