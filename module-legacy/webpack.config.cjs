const path = require('path')
const fs = require('fs')

const entries = {
	'legacy-base': './dist/index.js',
}

const outerDir = './entrypoints'
const dirs = fs.readdirSync(outerDir)

for (const file of dirs) {
	entries[`companion-module-${path.parse(file).name}/index`] = `./entrypoints/${file}`
}

module.exports = {
	entry: entries,
	mode: 'production',
	output: {
		path: path.resolve(process.cwd(), 'manifests'),
	},
	context: path.resolve(process.cwd(), '.'),
	target: 'node',
	externals: {
		// Avoid bundling the common code into all the modules
		'../../dist/index.js': 'commonjs2 ../legacy-base.js',

		// Native libs that are needed
		// TODO - these need to be made available at runtime
		sharp: 'commonjs2 sharp',
		ssh2: 'commonjs2 ssh2',
		'cpu-features': 'commonjs2 cpu-features',
		'node-ssdp': 'commonjs2 node-ssdp',
		serialport: 'commonjs2 fake-module-this-isnt-real',
		'@julusian/skia-canvas': 'commonjs2 @julusian/skia-canvas',
	},
	// experiments: {
	// 	topLevelAwait: true,
	// },
	module: {
		rules: [
			// {
			// 	test: /\.json$/,
			// 	type: 'asset/inline',
			// },
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
