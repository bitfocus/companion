const path = require('path')
const fs = require('fs')
const SentryWebpackPlugin = require('@sentry/webpack-plugin')

const sentryAuthToken = process.env.SENTRY_AUTH_TOKEN

const distPath = path.resolve(__dirname, 'dist')
const buildFile = fs.readFileSync(path.join(__dirname, 'BUILD')).toString().trim()

module.exports = {
	entry: {
		main: './main.js',
		Handler: './lib/Surface/USB/Handler.js',
	},
	mode: 'production',
	devtool: sentryAuthToken ? 'source-map' : undefined,
	output: {
		// filename: 'main.js',
		path: distPath,
	},
	context: path.resolve(__dirname, '.'),
	target: 'node',
	// node: {
	// 	__dirname: true,
	// 	__filename: true,
	// 	global: false,
	// },
	// resolve: {
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
	// },
	externalsPresets: { node: true },
	externals: {
		// Native libs that are needed
		'node-hid': 'commonjs2 node-hid',
		sharp: 'commonjs2 sharp',
		usb: 'commonjs2 usb',
		bufferutil: 'commonjs2 bufferutil',
		'utf-8-validate': 'commonjs2 utf-8-validate',
		'@serialport/bindings-cpp': 'commonjs2 @serialport/bindings-cpp',
	},
	experiments: {
		topLevelAwait: true,
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
	},
	plugins: [
		sentryAuthToken
			? new SentryWebpackPlugin({
					url: 'https://sentry.bitfocus.io/',
					authToken: sentryAuthToken,

					org: 'bitfocus',
					project: 'companion',

					include: distPath,
					urlPrefix: '~/',

					// Auth tokens can be obtained from https://sentry.io/settings/account/api/auth-tokens/
					// and needs the `project:releases` and `org:read` scopes

					release: `companion@${buildFile}`,
			  })
			: '',
	].filter(Boolean),
}
