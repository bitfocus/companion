const chai = require('chai')
const fs = require('fs')
const path = require('path')

var expect = require('chai').expect
var assert = require('chai').assert

chai.use(require('chai-fs'))

const possibleModuleFolders = fs.readdirSync(path.join(__dirname, '../node_modules'))
const moduleList = possibleModuleFolders
	.filter((folder) => folder.match(/companion-module-/))
	.map((folder) => [folder, path.join(__dirname, '../node_modules', folder)])

describe('package.json main script exists', function () {
	for (const [module, folderPath] of moduleList) {
		it(module, function () {
			this.timeout(10000)
			const data = fs.readFileSync(folderPath + '/package.json')
			const js = JSON.parse(data.toString())
			const main_script = folderPath + '/' + js.main
			assert.pathExists(main_script)
		})
	}
})

describe('Module loads', function () {
	for (const [module, folderPath] of moduleList) {
		it(module, function () {
			this.timeout(10000)
			require(folderPath)
		})
	}
})

describe('package.json has all fields', function () {
	for (const [module, folderPath] of moduleList) {
		it(module, function () {
			this.timeout(10000)
			const data = fs.readFileSync(folderPath + '/package.json')
			const js = JSON.parse(data.toString())

			assert.containsAllKeys(js, [
				'name',
				'version',
				// 'api_version',
				// 'description',
				'main',
				'keywords',
				'manufacturer',
				'product',
				'shortname',
				'author',
				'license',
			])
		})
	}
})
