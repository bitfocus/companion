const path = require('path')

const frameworkDir = path.relative(process.cwd(), path.resolve('@companion-module/base'))
const pkgJson = require(path.join(process.cwd(), 'package.json'))

if (!pkgJson.main) throw new Error(`Missing main in package.json`)

module.exports = {
	entry: {
		main: './' + pkgJson.main, // path.join(frameworkDir, 'dist/entrypoint.js'),
		// TODO - any other entrypoints will be needed here
	},
	mode: 'production',
	output: {
		path: path.resolve(process.cwd(), 'pkg'),
	},
	context: path.resolve(process.cwd(), '.'),
	target: 'node',
	// externals: {
	// TODO - any native libs will need to be here
	// },
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
