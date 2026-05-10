import path from 'path'
import type { StorybookConfig } from '@storybook/react-vite'
import { mergeConfig } from 'vite'

const config: StorybookConfig = {
	stories: ['../src/**/*.stories.tsx'],
	framework: {
		name: '@storybook/react-vite',
		options: {},
	},
	typescript: {
		// react-docgen-typescript crawls ALL TypeScript source files to extract prop types.
		// In this large monorepo that exhausts the heap. Disable it.
		reactDocgen: false,
	},
	viteFinal: async (cfg) => {
		return mergeConfig(cfg, {
			resolve: {
				alias: {
					// Don't use the auto tsconfig paths, it causes vite to explore too much and run out of memory
					'~': path.resolve(import.meta.dirname, '../src'),
				},
			},
			build: {
				sourcemap: false,
			},
		})
	},
}

export default config
