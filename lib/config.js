var debug = require('debug')('config')
var fs = require('fs-extra')

module.exports = exports = function (system, cfgDir, defaults) {
	return new config(system, cfgDir, defaults)
}

function config(system, cfgDir, defaults) {
	var self = this

	self.store = {}
	self.defaults = defaults
	self.lastsave = Date.now()

	system.on('config_object', function (cb) {
		debug('config_object()')
		cb(self.store)
	})

	system.on('config_get', function (key, cb) {
		debug('config_get(' + key + ')')
		cb(self.store[key])
	})

	system.on('config_save', function () {
		var now = Date.now()
		debug('config_save(): begin')

		if (now - self.lastsave > 2000) {
			fs.writeFile(cfgDir + '/config.tmp', JSON.stringify(self.store), function (err) {
				debug('config_save(): rename config.tmp')

				if (err) {
					debug('Error saving: ', err)
					system.emit('config_saved', err)
					return
				}

				fs.rename(cfgDir + '/config.tmp', cfgDir + '/config', function (err) {
					if (err) {
						debug('Error renaming: ', err)
						system.emit('config_saved', err)
						return
					}

					self.lastsave = Date.now()
					self.changed = false

					debug('config written')
					system.emit('config_saved', null)
				})
			})
		}
	})

	system.on('config_set', function (key, value) {
		debug('config_set(' + key + ')')
		self.store[key] = value
		self.changed = true
		system.emit('config_save')
	})

	var config_file = cfgDir + '/config'

	if (!fs.existsSync(cfgDir)) {
		debug('no config dir exists. creating:', cfgDir)
		fs.mkdirSync(cfgDir)
	}

	if (fs.existsSync(config_file)) {
		debug(config_file, 'exists. trying to read')
		var data = fs.readFileSync(config_file)
		try {
			self.store = JSON.parse(data)
			debug('parsed JSON')
		} catch (e) {
			self.store = {}
			debug('going default')
		}
		system.emit('config_loaded', self.store)
	} else {
		debug(config_file, 'didnt exist. loading blank', self.defaults)
		system.emit('config_loaded', self.defaults)
		self.store = self.defaults
		self.changed = true
		system.emit('config_save')
	}

	setInterval(function () {
		if (self.changed) {
			debug('interval-save')
			system.emit('config_save')
		}
	}, 5000)
}
