const path = require('path')

const frameworkDir = path.relative(process.cwd(), path.resolve('@companion-module/base'))
const pkgJson = require(path.join(process.cwd(), 'package.json'))

if (!pkgJson.main) throw new Error(`Missing main in package.json`)

module.exports = {
	entry: {
		main: './' + pkgJson.main, // path.join(frameworkDir, 'dist/entrypoint.js'),
		// Handler: './lib/Surface/USB/Handler.js',
	},
	mode: 'development',
	output: {
		// filename: 'main.js',
		path: path.resolve(process.cwd(), 'pkg'),
	},
	context: path.resolve(process.cwd(), '.'),
	target: 'node',
	// externals: {
	// 	'node-hid': 'commonjs2 node-hid',
	// 	sharp: 'commonjs2 sharp',
	// },
	experiments: {
		topLevelAwait: true,
	},
	// module: {
	// 	rules: [
	// 		// {
	// 		// 	test: /\.json/,
	// 		// 	type: 'asset/inline',
	// 		// },
	// 		{
	// 			test: /BUILD$/,
	// 			type: 'asset/resource',
	// 			generator: {
	// 				filename: 'BUILD',
	// 			},
	// 		},
	// 	],
	// },
}
