import path from 'path'
import fs from 'fs'
import { sentryWebpackPlugin } from '@sentry/webpack-plugin'
// eslint-disable-next-line n/no-extraneous-import
import TerserPlugin from 'terser-webpack-plugin'

// Allow user to set mode at run time. Default is 'development' mode.
const devMode = process.env.WEBPACK_IN_DEV_MODE ? 'development' : 'production'
//const optimizeUseProduction = false // for enabling/disabling optimizations; default: devMode === production'
console.log(`Running webpack in ${devMode} mode.`)

const sentryAuthToken = process.env.SENTRY_AUTH_TOKEN

const distPath = path.resolve(import.meta.dirname, '../dist')
const buildFile = fs.readFileSync(path.resolve(import.meta.dirname, '../BUILD'), 'utf8').trim()

export default {
	entry: {
		main: './dist/main.js',
		// Handler: './lib/Surface/USB/Handler.js',
		RenderThread: './dist/Graphics/Thread.js',
		SurfaceThread: './dist/Instance/Surface/Thread/Entrypoint.js',
	},
	mode: devMode,
	// note: `undefined` defaults to 'eval' in dev mode, which is not compatible with `output.module: true` (particularly when `importMeta: false`)
	devtool: devMode === 'production' ? 'source-map' : false,
	output: {
		filename: '[name].js', // override default .mjs for `output.module: true`
		path: distPath,
		pathinfo: true,
		// environment: {
		// 	module: true,
		// },
		module: true,
	},
	context: path.resolve(import.meta.dirname, '.'),
	target: 'node',
	// node: { // don't use!  for the node target it is eval-only by default (i.e. tells webpack to defer the resolution to runtime)
	// 	__dirname: true,
	// 	__filename: true,
	// 	//global: false,
	// },
	resolve: {
		extensionAlias: {
			'.js': ['.ts', '.js'],
			'.mjs': ['.mts', '.mjs'],
		},
	},
	externalsPresets: { node: true },
	externals: {
		// Native libs that are needed
		usb: 'usb',
		bufferutil: 'commonjs2 bufferutil', // This needs to remain commonjs2, so that it remains as an optional `require()`
		'@napi-rs/canvas': '@napi-rs/canvas',
	},
	experiments: {
		topLevelAwait: true,
		outputModule: true,
	},
	module: {
		parser: {
			javascript: {
				importMeta: false, // don't convert import.meta.url to a hardcoded string
				// url:false is needed when Registry uses a URL to resolve files (package.json, BUILD,...)
				url: false, // as a side-benefit, it reduces the number of webpack warnings
			},
		},
	},
	plugins: [
		sentryAuthToken
			? sentryWebpackPlugin({
					authToken: sentryAuthToken,

					org: 'bitfocus',
					project: 'companion',

					release: {
						name: `companion@${buildFile}`,
					},
					errorHandler: (err) => {
						console.warn('Sentry error', err)
					},
				})
			: '',
	].filter(Boolean),
	optimization: {
		minimize: true,
		minimizer: [
			new TerserPlugin({
				terserOptions: {
					module: true,
				},
			}),
		],
	},
}
