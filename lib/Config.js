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

const fs = require('fs-extra')
const App = require('../app')

module.exports = exports = function (system, cfgDir, defaults) {
	return new Config(system, cfgDir, defaults)
}

class Config {
	debug = require('debug')('lib/Config')

	constructor(
		/** @type {App} */
		system,
		/** @type {string} */
		cfgDir,
		defaults
	) {
		this.system = system
		this.store = {}
		this.defaults = defaults
		this.lastsave = Date.now()

		this.system.on('config_object', (cb) => {
			this.debug('config_object()')
			cb(this.store)
		})

		this.system.on('config_get', (key, cb) => {
			this.debug('config_get(' + key + ')')
			cb(this.store[key])
		})

		this.system.on('config_save', () => {
			const now = Date.now()
			this.debug('config_save(): begin')

			if (now - this.lastsave > 2000) {
				fs.writeFile(cfgDir + '/config.tmp', JSON.stringify(this.store), (err) => {
					this.debug('config_save(): rename config.tmp')

					if (err) {
						this.debug('Error saving: ', err)
						this.system.emit('config_saved', err)
						return
					}

					fs.rename(cfgDir + '/config.tmp', cfgDir + '/config', (err) => {
						if (err) {
							this.debug('Error renaming: ', err)
							this.system.emit('config_saved', err)
							return
						}

						this.lastsave = Date.now()
						this.changed = false

						this.debug('config written')
						this.system.emit('config_saved', null)
					})
				})
			}
		})

		this.system.on('config_set', (key, value) => {
			this.debug('config_set(' + key + ')')
			this.store[key] = value
			this.changed = true
			this.system.emit('config_save')
		})

		const config_file = cfgDir + '/config'

		if (!fs.existsSync(cfgDir)) {
			this.debug('no config dir exists. creating:', cfgDir)
			fs.mkdirSync(cfgDir)
		}

		if (fs.existsSync(config_file)) {
			this.debug(config_file, 'exists. trying to read')
			let data = fs.readFileSync(config_file)
			try {
				this.store = JSON.parse(data)
				this.debug('parsed JSON')
			} catch (e) {
				this.store = {}
				this.debug('going default')
			}
			this.system.emit('config_loaded', this.store)
		} else {
			this.debug(config_file, 'didnt exist. loading blank', this.defaults)
			this.system.emit('config_loaded', this.defaults)
			this.store = this.defaults
			this.changed = true
			this.system.emit('config_save')
		}

		setInterval(() => {
			if (this.changed) {
				this.debug('interval-save')
				this.system.emit('config_save')
			}
		}, 5000)
	}
}
