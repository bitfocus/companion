const path = require('path')

module.exports = {
	entry: {
		main: './headless.js',
		Handler: './lib/Surface/USB/Handler.js',
	},
	mode: 'development',
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
	externals: {
		// 'node-hid': 'commonjs2 node-hid',
		sharp: 'commonjs2 sharp',
	},
}
