import mainConfig from '@dataport/eslint-config-geodev'
import browserConfig from '@dataport/eslint-config-geodev/browser'
import htmlConfig from '@dataport/eslint-config-geodev/html'
import jsonConfig from '@dataport/eslint-config-geodev/json'
import markdownConfig from '@dataport/eslint-config-geodev/markdown'
import nodeConfig from '@dataport/eslint-config-geodev/node'
import tsConfig from '@dataport/eslint-config-geodev/typescript'
import tsVueConfig from '@dataport/eslint-config-geodev/typescript-vue'
import vueConfig from '@dataport/eslint-config-geodev/vue'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
	globalIgnores(['dist/', 'coverage/']),
	{
		name: 'project/code',
		files: ['**/*.ts', '**/*.vue'],
		extends: [mainConfig, tsConfig, tsVueConfig],
	},
	{
		name: 'project/browser',
		files: ['src/**/*.ts', 'src/**/*.vue', 'env.d.ts'],
		extends: [browserConfig],
	},
	{
		name: 'project/node',
		files: ['*.config.ts'],
		extends: [nodeConfig],
	},
	{
		// ESLint rule names (e.g. 'vue/html-indent') can only be written as quoted keys.
		// Same options as the shared config, plus an exception for keys that require quotes.
		name: 'project/eslint-config-file',
		files: ['eslint.config.ts'],
		rules: {
			'@typescript-eslint/naming-convention': [
				'error',
				{ selector: ['typeLike'], format: ['PascalCase'] },
				{ selector: ['memberLike'], format: ['camelCase', 'UPPER_CASE', 'snake_case'] },
				{ selector: ['objectLiteralProperty'], modifiers: ['requiresQuotes'], format: null },
			],
		},
	},
	{
		// Must come after the TypeScript config so that vue-eslint-parser handles .vue files.
		name: 'project/vue',
		files: ['**/*.vue'],
		extends: [vueConfig],
		rules: {
			// The course requires tabs; the Vue preset defaults to two spaces in templates.
			'vue/html-indent': ['error', 'tab'],
		},
	},
	{
		name: 'project/html',
		files: ['**/*.html'],
		extends: [htmlConfig],
	},
	{
		name: 'project/json',
		files: ['**/*.json'],
		ignores: ['package-lock.json'],
		extends: [jsonConfig],
	},
	{
		// tsconfig and VS Code files allow comments.
		name: 'project/jsonc',
		files: ['tsconfig*.json', '.vscode/*.json'],
		language: 'json/jsonc',
	},
	{
		name: 'project/markdown',
		files: ['**/*.md'],
		extends: [markdownConfig],
	},
])
