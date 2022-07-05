const path = require('path')

const frameworkDir = path.relative(process.cwd(), path.resolve('@companion-module/base'))
const pkgJson = require(path.join(process.cwd(), 'package.json'))

if (!pkgJson.main) throw new Error(`Missing main in package.json`)

let webpackExt = {}
try {
	webpackExt = require(path.join(process.cwd(), 'webpack-ext.cjs'))

	console.log('Found additional webpack configuration')
} catch (e) {
	// Ignore
}

let externalsExt = []
if (Array.isArray(webpackExt.externals)) externalsExt = webpackExt.externals
else if (webpackExt.externals) externalsExt = [webpackExt.externals]

module.exports = {
	entry: {
		main: './' + pkgJson.main, // path.join(frameworkDir, 'dist/entrypoint.js'),
		// Allow for custom entrypoints
		...webpackExt.entry,
	},
	mode: 'production',
	// devtool: 'source-map', // TODO - this would be nice, but I think the files have to be uploaded directly to sentry which is problematic...
	// mode: 'development',
	output: {
		path: path.resolve(process.cwd(), 'pkg'),
	},
	context: path.resolve(process.cwd(), '.'),
	target: 'node',
	externals: [
		// Allow for custom externals
		...externalsExt,
	],
	experiments: {
		topLevelAwait: true,
	},
	module: {
		rules: [
			{
				test: /\.json$/,
				type: 'asset/inline',
			},
			// {
			// 	test: /BUILD$/,
			// 	type: 'asset/resource',
			// 	generator: {
			// 		filename: 'BUILD',
			// 	},
			// },
		],
	},
}
