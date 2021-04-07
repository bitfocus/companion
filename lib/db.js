/*
 * This file is part of the Companion project
 * Copyright (c) 2018 Bitfocus AS
 * Authors: William Viker <william@bitfocus.io>, Håkon Nessjøen <haakon@bitfocus.io>
 *
 * This program is free software.
 * You should have received a copy of the MIT licence as well as the Bitfocus
 * Individual Contributor License Agreement for companion along with
 * this program.
 *
 * You can be released from the requirements of the license by purchasing
 * a commercial license. Buying such a license is mandatory as soon as you
 * develop commercial activities involving the Companion software without
 * disclosing the source code of your own applications.
 *
 */

var debug = require('debug')('lib/db')
var fs = require('fs-extra')
var path = require('path')

/**
	Simpel KVS som forventer at all data har plass i ram.

	Events: (system objektet)
		* db_loaded(data) - Alle data
		* db_saved(err) - kommandoen db_save ble fullført (eller feilet)

	Svarer på events: (system objektet)
		* db_set(key, value) - Sett key til value
		* db_get(key, cb) - Hent verdi til key i store, emitter svar til 'cb'
		* db_get_multiple([key1,key2], cb) - Henter verdier til flere keys, returnerer som array til 'cb'
		* db_save - Lagrer db fra minne til fil. Svarer med db_saved. (se over)
*/

var lastsave = 0
var saveInterval = 4000 // Minimum 4 seconds between each save
var dirty = false
var saving = false

module.exports = exports = function (system, cfgDir) {
	return new db(system, cfgDir)
}

function db(system, cfgDir) {
	debug('new(db)')
	var self = this
	self.system = system
	self.db = {}

	var pathDb = path.join(cfgDir, 'db')
	var pathDbTmp = path.join(cfgDir, 'db.tmp')
	var pathDbBak = path.join(cfgDir, 'db.bak')

	try {
		var data = fs.readFileSync(pathDb)

		self.db = JSON.parse(data)
		debug('db loaded')

		var changed_after_load = false
		// db defaults
		if (self.db.userconfig === undefined) {
			self.db.userconfig = {}
			changed_after_load = true
		}

		// is page up 1->2 or 2->1?
		if (self.db.userconfig.page_direction_flipped === undefined) {
			self.db.userconfig.page_direction_flipped = false
			changed_after_load = true
		}

		system.emit('db_loaded', self.db)

		if (changed_after_load === true) {
			debug('config changed by default values after load, saving.')
			system.emit('db_save')
		}
	} catch (err) {
		if (err.code == 'ENOENT') {
			debug('readFile(db)', 'Couldnt read db, loading {}')
			system.emit('db_loaded', {})
		} else {
			throw err
		}
	}

	system.on('db_all', function (cb) {
		debug('db_all(): returning all database values')
		if (typeof cb == 'function') {
			cb(self.db)
		}
	})

	system.on('db_set', function (key, value) {
		debug('db_set(' + key + ', ' + value + ')')
		self.db[key] = value
	})

	system.on('db_del', function (key) {
		debug('db_del(' + key + ')')
		delete self.db[key]
	})

	system.on('db_set_multiple', function (keyvalueobj) {
		debug('db_set_multiple:')
		for (var key in keyvalueobj) {
			debug('db_set(' + key + ',' + keyvalueobj[key] + ')')
			self.db[key] = keyvalueobj[key]
		}
	})

	system.on('db_get', function (key, cb) {
		debug('db_get(' + key + ')')
		cb(self.db[key])
	})
	system.on('db_get_multiple', function (keys, cb) {
		if (typeof keys != 'object' || typeof keys.length == 'undefined') {
			throw new Error('keys is not an array')
		}
		cb(
			keys.map(function (key) {
				return self.db[key]
			})
		)
	})

	async function doSave() {
		const jsonStr = JSON.stringify(self.db)

		try {
			await fs.copy(pathDb, pathDbBak)
		} catch (err) {
			debug('db_save', 'Error making backup of config: ' + err)
		}

		try {
			await fs.writeFile(pathDbTmp, jsonStr)
		} catch (err) {
			debug('db_save', 'Error saving: ' + err)
			throw 'Error saving: ' + err
		}

		debug('db_save', 'written')

		try {
			await fs.rename(pathDbTmp, pathDb)
		} catch (err) {
			debug('db_save', 'Error renaming db.tmp: ' + err)
			throw 'Error renaming db.tmp: ' + err
		}

		debug('db_save', 'renamed')
		system.emit('db_saved', null)
	}

	system.on('db_save', function () {
		if (!saving && Date.now() - lastsave > saveInterval) {
			debug('db_save', 'begin')

			dirty = false
			lastsave = Date.now()
			saving = true

			doSave()
				.catch((err) => {
					try {
						self.system.emit('log', 'CORE(cb)', 'error', err)
					} catch (err2) {
						// make sure to not throw an error here
						debug('db_save', 'Error reporting save failure: ' + err2)
					}
				})
				.then(() => {
					// This will run even if the catch caught an error
					saving = false
				})
		} else {
			dirty = true
		}
	})

	// Do a save sometime within the next 10 seconds
	system.on('db_dirty', function () {
		dirty = true
	})

	// If last db_save was not handeled because of throttling, do it now
	setInterval(function () {
		if (Date.now() - lastsave > saveInterval && dirty) {
			system.emit('db_save')
		}
	}, 4000)
}
