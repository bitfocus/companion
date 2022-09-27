const path = require('path')

module.exports = {
	entry: {
		main: './main.js',
		Handler: './lib/Surface/USB/Handler.js',
	},
	mode: 'production',
	output: {
		// filename: 'main.js',
		path: path.resolve(__dirname, 'dist'),
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
}
