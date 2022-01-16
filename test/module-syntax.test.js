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
				expect(js).toHaveProperty('version')
				// expect(js).toHaveProperty('api_version')
				// expect(js).toHaveProperty('description')
				expect(js).toHaveProperty('main')
				expect(js).toHaveProperty('keywords')
				expect(js).toHaveProperty('manufacturer')
				expect(js).toHaveProperty('product')
				expect(js).toHaveProperty('shortname')
				expect(js).toHaveProperty('author')
				expect(js).toHaveProperty('license')
			},
			10000
		)
	}
})
