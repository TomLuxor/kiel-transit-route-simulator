/// <reference types="vite/client" />

// Lets typed linting (plain TypeScript) resolve .vue imports; vue-tsc uses the real component types.
declare module '*.vue' {
	import type { DefineComponent } from 'vue'

	const component: DefineComponent
	export default component
}
