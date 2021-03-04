var chai = require('chai')

var fs = require('fs')

var items = fs.readdirSync('./lib/module')

var expect = require('chai').expect
var assert = require('chai').assert

chai.use(require('chai-fs'))

describe('package.json main script exists', function () {
	for (var n in items) {
		var module = items[n]
		var data = fs.readFileSync('./lib/module/' + module + '/package.json')
		var js = JSON.parse(data.toString())
		var main_script = './lib/module/' + module + '/' + js.main
		var main_lib = '../lib/module/' + module
		it(module, function () {
			this.timeout(10000)
			assert.pathExists(main_script, module)
		})
	}
})

describe('Module loads', function () {
	for (var n in items) {
		var module = items[n]
		var data = fs.readFileSync('./lib/module/' + module + '/package.json')
		var js = JSON.parse(data.toString())
		var main_script = './lib/module/' + module + '/' + js.main
		var main_lib = '../lib/module/' + module
		it(module, function () {
			this.timeout(10000)
			var mod = require(main_lib)
		})
	}
})
