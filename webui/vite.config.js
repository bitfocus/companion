import { defineConfig } from 'vite'
import reactPlugin from '@vitejs/plugin-react'
import envCompatible from 'vite-plugin-env-compatible'

// https://vitejs.dev/config/
export default defineConfig({
	publicDir: 'public',
	// This changes the out put dir from dist to build
	// comment this out if that isn't relevant for your project
	build: {
		outDir: 'build',
	},
	server: {
		proxy: {
			'/int': 'http://localhost:8000',
			'/docs': 'http://localhost:8000',
			'/socket.io': 'http://localhost:8000',
		},
	},
	plugins: [
		reactPlugin(),
		envCompatible.default({
			prefix: 'DEV',
		}),
	],
	css: {
		preprocessorOptions: {
			scss: {
				quietDeps: true,
			},
		},
	},
})
