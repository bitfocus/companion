const fs = require('fs')
const path = require('path')

const possibleModuleFolders = fs.readdirSync(path.join(__dirname, '../node_modules'))
const moduleList = possibleModuleFolders
	.filter((folder) => folder.match(/companion-module-/))
	.map((folder) => [folder, path.join(__dirname, '../node_modules', folder)])

describe('package.json main script exists', function () {
	for (const [moduleName, folderPath] of moduleList) {
		test(
			moduleName,
			function () {
				const data = fs.readFileSync(folderPath + '/package.json')
				const js = JSON.parse(data.toString())
				const main_script = folderPath + '/' + js.main

				expect(fs.existsSync(main_script)).toBeTruthy()
			},
			10000
		)
	}
})

// describe('Module loads', function () {
// 	for (const [moduleName, folderPath] of moduleList) {
// 		test(
// 			moduleName,
// 			function () {
// 				require(folderPath)
// 			},
// 			10000
// 		)
// 	}
// })

describe('package.json has all fields', function () {
	for (const [moduleName, folderPath] of moduleList) {
		test(
			moduleName,
			function () {
				const data = fs.readFileSync(folderPath + '/package.json')
				const js = JSON.parse(data.toString())

				expect(js).toHaveProperty('name')
				expect(js.name).toBeTruthy()
				expect(typeof js.name).toBe('string')

				expect(js).toHaveProperty('version')
				expect(js.version).toBeTruthy()
				expect(typeof js.version).toBe('string')

				// expect(js).toHaveProperty('api_version')
				// expect(js).toHaveProperty('description')

				expect(js).toHaveProperty('main')
				expect(js.main).toBeTruthy()
				expect(typeof js.main).toBe('string')

				expect(js).toHaveProperty('keywords')
				expect(js.keywords).toBeInstanceOf(Array)

				expect(js).toHaveProperty('manufacturer')
				expect(js.manufacturer).toBeTruthy()

				expect(js).toHaveProperty('product')
				expect(js.product).toBeTruthy()
				// expect(typeof js.product).toBe('string')

				expect(js).toHaveProperty('shortname')
				expect(js.shortname).toBeTruthy()
				// expect(typeof js.shortname).toBe('string')

				expect(js).toHaveProperty('author')
				expect(js.author).toBeTruthy()

				expect(js).toHaveProperty('license')
				expect(js.license).toBeTruthy()
				expect(typeof js.license).toBe('string')
			},
			10000
		)
	}
})
