# Kiel Transit Route Simulator

A web map application for the course *Geographical Web Applications* (HAW Kiel, winter semester 2026/27).

Kiel is planning a light rail system (Stadtbahn). This application shows the planned lines on a map, each line in its own color. You select two points on the network, on the same line or on different lines. The map then zooms to the starting point and moves along the line to the destination. If the route needs a change of line, it follows both lines and shows the transfer.

> **Status:** project baseline. The tooling is set up; the map and the simulation are not implemented yet. The step-by-step plan is in [PLAN.md](PLAN.md).

## Data sources

| Data | Source | Provider, license |
| --- | --- | --- |
| Planned Stadtbahn route sections (geometry of the whole 35.8 km core network) | WFS, layer `lhkiel:Trassenabschnitte` ([capabilities](https://ims.kiel.de/geodatenextern/services/Stadtplan/LHKielWmsWfs/MapServer/WFSServer?service=WFS&request=GetCapabilities), [metadata](https://www.geoportal.de/info/8ae2e3a0-23ff-4551-b71f-3dba6972cb4b)) | © Landeshauptstadt Kiel, CC BY 4.0 |
| Stadtbahn planning layers (variants, road works, areas per section) | WMS ([capabilities](https://ims.kiel.de/geodatenextern/services/Stadtplan/Stadtbahn_WMS/MapServer/WMSServer?service=WMS&request=GetCapabilities)) | © Landeshauptstadt Kiel |
| Line network (which line runs on which sections) | *Trassenstudie für ein zukunftssicheres ÖPNV-System auf eigener Trasse*, final report, October 2022, section 2.3 ([PDF](https://www.kiel.de/de/umwelt_verkehr/_dokumente_kiel_bewegt_sich/endbericht/kiel_oepnv_system_endbericht_trassenstudie_fuer_ein_zukunftssicheres_oepnv_system_auf_eigener_trasse.pdf)) | Landeshauptstadt Kiel |

No public service publishes the lines themselves or the stops. The application therefore builds the four lines from the route sections, following the line network of the final report.

## Tech stack

- [Vue 3](https://vuejs.org/) with TypeScript, built with [Vite](https://vite.dev/)
- [OpenLayers](https://openlayers.org/) for the map
- [ESLint](https://eslint.org/) with the shared config [`@dataport/eslint-config-geodev`](https://github.com/Dataport/eslint-config-geodev)

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
| `npm run lint` | Check the code with ESLint |
| `npm run lint:fix` | Fix the ESLint findings that can be fixed automatically |
| `npm run type-check` | Check the types with `vue-tsc` |
