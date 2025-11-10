import path from 'path'
import fs from 'fs'
import { sentryWebpackPlugin } from '@sentry/webpack-plugin'
import { fileURLToPath } from 'url'
// import { createRequire } from 'module'
// const require = createRequire(import.meta.url)

// Allow user to set mode at run time. Default is 'development' mode.
// note: alternatively, leave devMode out and use CLI argument --mode=development (default is production)
// but that would take a bit of argv management in dist.mts...
const devMode = process.env.WEBPACK_IN_DEV_MODE ? 'development' : 'production'
//const optimizeUseProduction = false // for enabling/disabling optimizations; default: devMode === production'
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
	// note: `undefined` defaults to 'eval' in dev mode, which is not compatible with `output.module: true` (particularly when `importMeta: false`)
	devtool: devMode === 'production' ? 'source-map' : false, //sentryAuthToken ? 'source-map' : false,
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
		// The following optimizations are enabled only in 'production' mode
		// 	flagIncludedChunks: optimizeUseProduction,
		// 	moduleIds: 'named', // optimizeUseProduction ? "deterministic" : 'named'
		// 	chunkIds: 'named', // optimizeUseProduction ? "deterministic" : 'named'
		// 	sideEffects: 'flag', // () => (production ? true : "flag"),
		// 	usedExports: optimizeUseProduction,
		// 	innerGraph: optimizeUseProduction,
		// 	mangleExports: optimizeUseProduction,
		// avoid error in webpack 5.102.1
		concatenateModules: false, // default: optimizeUseProduction,
		// 	avoidEntryIife: optimizeUseProduction,
		// 	emitOnErrors: !optimizeUseProduction,
		// 	checkWasmTypes: optimizeUseProduction,
		// 	realContentHash: optimizeUseProduction,
		// 	minimize: optimizeUseProduction,
		// 	//nodeEnv: devMode// probably best never to alther this one.
	},
}
