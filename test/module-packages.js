var fs = require('fs')

var items = fs.readdirSync('./lib/module')

var expect = require('chai').expect
var assert = require('chai').assert

describe('package.json has all fields', function () {
	for (var n in items) {
		var module = items[n]
		var data = fs.readFileSync('./lib/module/' + module + '/package.json')
		var js = JSON.parse(data.toString())

		it(module, function () {
			assert.hasAllKeys(js, [
				'name',
				'version',
				'api_version',
				'description',
				'main',
				'scripts',
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
