import path from 'path'
import fs from 'fs'
import { sentryWebpackPlugin } from '@sentry/webpack-plugin'
import { fileURLToPath } from 'url'
// import { createRequire } from 'module'
// const require = createRequire(import.meta.url)

const devMode = process.env.WEBPACK_IN_DEV_MODE ? 'development' : 'production'
console.log(`Running webpack in ${devMode} mode.`)

const sentryAuthToken = process.env.SENTRY_AUTH_TOKEN
const modulePath = path.dirname(fileURLToPath(import.meta.url))

const distPath = path.resolve(modulePath, '../dist')
const buildFile = fs.readFileSync(path.resolve(modulePath, '../BUILD')).toString().trim()

export default {
	entry: {
		main: './dist/main.js',
		// Handler: './lib/Surface/USB/Handler.js',
		RenderThread: './dist/Graphics/Thread.js',
	},
	mode: devMode,
	// note: `undefined` defaults to 'eval', which is not compatible with `output.module: true` (particularly when `importMeta: false`)
	devtool: 'source-map', //sentryAuthToken ? 'source-map' : false,
	output: {
		filename: '[name].js', // override default .mjs for `output.module: true`
		path: distPath,
		//clean: true, // works but maybe safer not to since we call webpack twice.
		pathinfo: true,
		// environment: {
		// 	module: true,
		// },
		module: true,
		// scriptType: 'module', // the default when module is true.
	},
	context: path.resolve(modulePath, '.'),
	target: 'node',
	// node: {
	// 	__dirname: true, //'node-module',
	// 	__filename: true, // 'node-module',
	// 	//global: false,
	// },
	resolve: {
		extensionAlias: {
			'.js': ['.ts', '.js'],
			'.mjs': ['.mts', '.mjs'],
		},
		// 	fallback: {
		// 		// use native node modules
		// 		fs: false,
		// 		buffer: false,
		// 		path: false,
		// 		stream: false,
		// 		zlib: false,
		// 		timers: false,
		// 		http: false,
		// 		https: false,
		// 	},
	},
	externalsPresets: { node: true },
	externals: {
		// Native libs that are needed (note: the commonjs2 modifier is incompatible with `output.module: true` )
		usb: 'usb',
		bufferutil: 'bufferutil',
		'@serialport/bindings-cpp': '@serialport/bindings-cpp',
		'@napi-rs/canvas': '@napi-rs/canvas',
	},
	experiments: {
		topLevelAwait: true,
		outputModule: true,
	},
	module: {
		rules: [
			// {
			// 	test: /\.json/,
			// 	type: 'asset/inline',
			// },
			// {
			// 	test: /\.\/package\.json$/,
			// 	type: 'asset/resource',
			// 	generator: {
			// 		filename: 'package.json',
			// 	},
			// },
			{
				test: /BUILD$/,
				type: 'asset/resource',
				generator: {
					filename: 'BUILD',
				},
			},
			{
				test: /SENTRY$/,
				type: 'asset/resource',
				generator: {
					filename: 'SENTRY',
				},
			},
		],
		parser: {
			javascript: {
				importMeta: false, // don't convert import.meta.url to a hardcoded string
				url: false, // 'relative', doesn't work or doesn't do what we want
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
}
