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

const fs = require('fs')
const shortid = require('shortid')
const { rgb, rgbRev, sendResult, serializeIsVisibleFn } = require('../Resources/Util')

class Instance {
	debug = require('debug')('lib/Instance')

	constructor(system) {
		this.system = system

		this.variable = require('./Variable')(system)
		this.preset = require('./Preset')(system)

		this.active = {}
		this.modules = {}
		this.modules_manufacturer = {}
		this.modules_category = {}
		this.modules_name = {}
		this.modules_main = {}
		this.modules_path = {}
		this.package_info = {}
		this.status = {}
		this.mod_redirects = {}

		this.store = {
			module: [],
			db: {},
		}

		this.numError = 0
		this.numWarn = 0
		this.numOk = 0

		this.system.on('instance_get_package_info', (cb) => {
			this.debug('getting instance_get_package_info')
			cb(this.package_info)
		})

		this.system.on('instance_save', () => {
			this.system.emit('db_set', 'instance', this.store.db)
			this.system.emit('db_save')
		})

		// levels: null = unknown, 0 = ok, 1 = warning, 2 = error
		this.system.on('instance_status_update', (instance, level, msg) => {
			this.status[instance] = [level, msg]
			this.calculateErrors()
			this.system.emit('instance_status', this.status)
			this.system.emit('instance_status_set', instance, level, msg)
		})

		this.system.on('instance_status_get', (instance, cb) => {
			cb(this.status[instance])
		})

		this.system.on('instance_config_get', (id, cb) => {
			cb(this.store.db[id])
		})

		this.system.on('instance_get', (id, cb) => {
			cb(this.active[id])
		})

		this.system.on('instance_getall', (cb) => {
			cb(this.store.db, this.active)
		})

		this.system.on('instance_delete', (id) => {
			this.system.emit('log', 'instance(' + id + ')', 'info', 'instance deleted')

			if (this.active[id] !== undefined) {
				if (this.active[id].destroy !== undefined && typeof this.active[id].destroy == 'function') {
					try {
						this.active[id].destroy()
					} catch (e) {
						this.system.emit('log', 'instance(' + id + ')', 'debug', 'Error while deleting instance: ' + e.message)
					}
				}

				delete this.active[id]
			}
			delete this.status[id]
			delete this.store.db[id]

			this.io.emit('instances_get:result', this.store.db)
			this.system.emit('instance_save')
		})

		this.system.on('launcher-power-status', (event) => {
			if (event == 'resume') {
				this.system.emit('log', 'system(power)', 'info', 'Resuming')

				for (const id in this.active) {
					this.system.emit(
						'log',
						'instance(' + this.active[id].label + ')',
						'debug',
						'Bringing back instance from sleep'
					)
					this.activate_module(id)
				}
			} else if (event == 'suspend') {
				this.system.emit('log', 'system(power)', 'info', 'Suspending')

				for (const id in this.active) {
					if (
						this.active[id] !== undefined &&
						this.active[id].destroy !== undefined &&
						typeof this.active[id].destroy == 'function'
					) {
						try {
							this.active[id].destroy()
						} catch (e) {
							this.system.emit(
								'log',
								'instance(' + this.active[id].label + ')',
								'debug',
								'Error suspending instance: ' + e.message
							)
						}
					}
				}
			}
		})

		this.system.on('http_req', (req, res, done) => {
			let match

			if ((match = req.url.match(/^\/help\/([^/]+)\/(.+?)(\?.+)?$/))) {
				let module = match[1].replace(/\.\.+/g, '')
				let file = match[2].replace(/\.\.+/g, '')
				let path = this.modules_path[module]

				if (file.match(/\.(jpe?g|gif|png|pdf)$/) && fs.existsSync(path + '/' + file)) {
					done()
					res.sendFile(path + '/' + file)
				}
			}
		})

		this.system.on('module_redirect', (name, cb) => {
			cb(this.mod_redirects[name])
		})

		this.system.on('instance_init', () => {
			this.debug('instance_init', this.store.db)

			let module_folders
			let path = require('app-root-path') + '/module-local-dev'

			if (fs.existsSync(path)) {
				module_folders = fs.readdirSync(path)

				if (module_folders.length > 0) {
					for (let i = 0; i < module_folders.length; ++i) {
						let folder = module_folders[i]

						if (folder == '.gitignore') {
							continue
						} else if (folder.match(/companion-module-/)) {
							folder = folder.substring(17)
							this.setupModule(folder, path + '/companion-module-')
						} else {
							this.setupModule(folder, path + '/')
						}
					}
				}
			}

			path = require('app-root-path') + '/node_modules'
			module_folders = fs.readdirSync(path)

			for (let i = 0; i < module_folders.length; ++i) {
				let folder = module_folders[i]

				if (folder.match(/companion-module-/)) {
					folder = folder.substring(17)

					if (this.modules_main[folder] !== undefined) {
						this.system.emit(
							'log',
							'module(' + folder + ')',
							'warn',
							'Module has been overridden by a local development copy.'
						)
					} else {
						this.setupModule(folder, path + '/companion-module-')
					}
				}
			}

			if (this.store.db['bitfocus-companion'] === undefined) {
				this.store.db['bitfocus-companion'] = {
					instance_type: 'bitfocus-companion',
					label: 'internal',
					id: 'bitfocus-companion',
				}
			}
			// Bugfix of corrupted configs
			else if (this.store.db['bitfocus-companion'] !== undefined) {
				if (this.store.db['bitfocus-companion'].id === undefined) {
					this.store.db['bitfocus-companion'].id = 'bitfocus-companion'
				}
			}

			for (const id in this.store.db) {
				let config = this.store.db[id]

				if (this.mod_redirects[config.instance_type] !== undefined) {
					config.instance_type = this.mod_redirects[config.instance_type]
				}

				if (this.checkModuleLoaded(config.instance_type)) {
					let mod = this.modules[config.instance_type]

					this.upgrade_instance_config(id, config.instance_type, config)

					if (config.enabled === false) {
						this.debug("Won't load disabled module " + id + ' (' + config.instance_type + ')')
						continue
					}

					this.active[id] = new mod(this.system, id, Object.assign({}, config))
					this.active[id].label = config.label

					if (typeof this.active[id]._init == 'function') {
						this.debug('Running _init of ' + id)
						try {
							this.active[id]._init()
						} catch (e) {
							this.system.emit(
								'log',
								'instance(' + this.active[id].label + ')',
								'warn',
								'Error initalizing module: ' + e.message
							)
						}
					}
				} else {
					this.debug('Configured instance ' + config.instance_type + ' could not be loaded, unknown module')
					if (config.instance_type != 'bitfocus-companion') {
						this.system.emit(
							'log',
							'instance(' + config.instance_type + ')',
							'error',
							'Configured instance ' + config.instance_type + ' could not be loaded, unknown module'
						)
					}
				}
			}

			this.system.emit('instances_loaded')
		})

		this.system.on(
			'instance_upgrade_imported',
			(instance_id, instance_created, instance_type, imported_config, actions, feedbacks) => {
				if (this.checkModuleLoaded(instance_type)) {
					const mod = this.modules[instance_type]

					this.upgrade_instance_config_partial(
						instance_id,
						instance_type,
						imported_config._configIdx,
						imported_config, // upgrade the config, even though we won't save the result anywhere
						actions,
						feedbacks
					)
				}
			}
		)

		this.system.emit('db_get', 'instance', (res) => {
			if (res === undefined) {
				this.store.db = {}
				this.system.emit('db_set', 'instance', this.store.db)
				this.system.emit('db_save')
			} else {
				this.store.db = res
			}

			// TODO: Implement dependency system
			setTimeout(() => {
				this.system.emit('instance_init')
			}, 2000)
		})

		this.system.emit('instance', this)

		this.system.emit('io_get', (io) => {
			this.io = io

			this.system.on('instance_status', (obj) => {
				io.emit('instance_status', obj)
			})

			this.system.on('io_connect', (client) => {
				this.connect(client)
			})
		})

		this.system.on('instance_add', (data, cb, disabled) => {
			let module = data.type
			let product = data.product

			if (this.checkModuleLoaded(module)) {
				let mod = this.modules[module]
				let id = shortid.generate()

				this.store.db[id] = {}

				this.system.emit('log', 'instance(' + id + ')', 'info', 'instance add ' + module + ' ' + product)

				this.store.db[id].instance_type = module
				this.store.db[id].product = product

				let label = this.package_info[module].shortname
				let i = 1
				let freename = false

				while (!freename) {
					freename = true
					for (const key in this.store.db) {
						if (this.store.db[key].label == label) {
							i++
							label = this.package_info[module].shortname + i
							freename = false
							break
						}
					}
				}

				this.store.db[id].label = label
				if (this.active[id] !== undefined) {
					this.active[id].label = this.store.db[id].label
				}

				if (disabled) {
					this.store.db[id].enabled = false
				}

				this.activate_module(id, mod, true)

				this.io.emit('instances_get:result', this.store.db)
				this.debug('instance_add', id)
				this.system.emit('instance_save')
				this.system.emit('actions_update')
				this.system.emit('feedback_update')

				if (typeof cb == 'function') {
					cb(id, this.store.db[id])
				}
			}
		})

		this.system.on('instance_activate', (id) => {
			this.activate_module(id)
		})

		this.system.on('instance_config_put', (id, config, internal) => {
			for (const key in config) {
				this.store.db[id][key] = config[key]
			}

			if (this.active[id] !== undefined) {
				if (this.active[id].label != this.store.db[id].label) {
					this.system.emit('variable_instance_label_rename', this.active[id].label, this.store.db[id].label, id)
				}

				this.active[id].label = this.store.db[id].label
			}

			this.system.emit('instance_save')
			this.io.emit('instances_get:result', this.store.db)

			if (!internal && this.active[id] !== undefined) {
				if (typeof this.active[id].updateConfig == 'function') {
					try {
						this.active[id].updateConfig(Object.assign({}, config))
					} catch (e) {
						this.system.emit(
							'log',
							'instance(' + this.active[id].label + ')',
							'warn',
							'Error updating instance configuration: ' + e.message
						)
					}
				}
			}

			this.system.emit('log', 'instance(' + id + ')', 'debug', 'instance configuration updated')
		})

		this.system.on('instance_enable', (id, state) => {
			if (this.store.db[id].enabled !== state) {
				this.system.emit(
					'log',
					'instance(' + id + ')',
					'info',
					(state ? 'Enable' : 'Disable') + ' instance ' + this.store.db[id].label
				)
				this.store.db[id].enabled = state

				if (state === true) {
					this.system.emit('instance_status_update', id, null, 'Enabling')
				} else {
					this.system.emit('instance_status_update', id, -1, 'Disabled')
				}

				if (state === false) {
					if (
						this.active[id] !== undefined &&
						this.active[id].destroy !== undefined &&
						typeof this.active[id].destroy == 'function'
					) {
						try {
							this.active[id].destroy()
						} catch (e) {
							this.system.emit('log', 'instance(' + id + ')', 'warn', 'Error disabling instance: ' + e.message)
						}
						delete this.active[id]
					}
				} else {
					this.activate_module(id)
				}

				this.system.emit('instance_save')
			} else {
				if (state === true) {
					this.system.emit('log', 'instance(' + id + ')', 'warn', 'Attempting to enable module that is alredy enabled')
				} else {
					this.system.emit(
						'log',
						'instance(' + id + ')',
						'warn',
						'Attempting to disable module that is alredy disabled'
					)
				}
			}
		})
	}

	upgrade_instance_config(id, instance_type) {
		const mod = this.modules[instance_type]
		if (!mod || mod.GetUpgradeScripts === undefined) {
			return
		}

		// Fetch instance actions
		let actions = []
		this.system.emit('actions_for_instance', id, (_actions) => {
			actions = _actions
		})
		let release_actions = []
		this.system.emit('release_actions_for_instance', id, (_release_actions) => {
			release_actions = _release_actions
		})
		let feedbacks = []
		this.system.emit('feedbacks_for_instance', id, (_feedbacks) => {
			feedbacks = _feedbacks
		})

		const config = this.store.db[id]
		const changed = this.upgrade_instance_config_partial(
			id,
			instance_type,
			config._configIdx,
			config,
			[...actions, ...release_actions],
			feedbacks
		)

		// If anything was changed, update system and db
		if (changed) {
			this.system.emit('action_save')
			this.system.emit('feedback_save')
		}
		this.debug('instance save')
		this.system.emit('instance_save')
	}

	upgrade_instance_config_partial(id, instance_type, from_idx, upgrade_config, actions, feedbacks) {
		const package_info = this.package_info[instance_type]
		const package_name = package_info ? package_info.name : instance_type
		const debug = require('debug')('instance/' + package_name + '/' + id)

		debug(`upgrade_instance_config_partial(${package_name}): starting`)

		const mod = this.modules[instance_type]
		if (!package_info || !mod || mod.GetUpgradeScripts === undefined) {
			debug(`upgrade_instance_config_partial(${package_name}): nothing to do`)
			return
		}

		let idx = from_idx
		if (idx === undefined) {
			idx = -1
		}

		// Allow forcing the scripts to run from an earlier point
		if (process.env.DEVELOPER && typeof mod.DEVELOPER_forceStartupUpgradeScript === 'number') {
			idx = mod.DEVELOPER_forceStartupUpgradeScript - 1
		}

		const upgrade_scripts = mod.GetUpgradeScripts() || []
		if (idx + 1 < upgrade_scripts.length) {
			debug(`upgrade_instance_config_partial(${package_info.name}): ${idx + 1} to ${upgrade_scripts.length}`)

			const context = {
				convert15to32: (bank) => {
					let new_bank = bank
					this.system.emit('bank_get15to32', bank, (_bank) => {
						new_bank = _bank
					})
					return new_bank
				},
				rgb: rgb,
				rgbRev: rgbRev,
			}

			let changed = false
			for (let i = idx + 1; i < upgrade_scripts.length; ++i) {
				debug(`upgrade_instance_config_partial: Upgrading to version ${i + 1}`)

				try {
					const result = upgrade_scripts[i](context, upgrade_config, actions, feedbacks)
					changed = changed || result
				} catch (e) {
					debug(`Upgradescript in ${package_info.name} failed: ${e}`)
				}

				if (upgrade_config) {
					upgrade_config._configIdx = i
				}
			}

			// ensure the ids havent been accidentally mangled
			for (const action of actions) {
				action.instance = id
				action.label = `${id}:${action.action}`
			}
			for (const feedback of feedbacks) {
				feedback.instance_id = id
			}

			// If we have no upgrade_config, we can avoid saving the config as we know we only have a reference here and nothing worth announcing has been changed
			// Also doing the save would be bad as we would potentially wipe some other changes
			if (upgrade_config && idx + 1 < upgrade_scripts.length) {
				// Save config, but do not automatically call this module's updateConfig again
				this.system.emit('instance_config_put', id, upgrade_config, true)
			}

			return changed
		} else {
			return false
		}
	}

	activate_module(id, modin, is_being_created) {
		let mod

		if (modin !== undefined) {
			mod = modin
		} else if (this.checkModuleLoaded(this.store.db[id].instance_type)) {
			mod = this.modules[this.store.db[id].instance_type]
		}

		try {
			this.active[id] = new mod(this.system, id, Object.assign({}, this.store.db[id]))

			if (is_being_created && this.store.db[id]._configIdx === undefined) {
				// New instances do not need to be upgraded
				if (mod.GetUpgradeScripts !== undefined) {
					const scripts = mod.GetUpgradeScripts()
					if (scripts !== undefined && scripts.length > 0) {
						this.store.db[id]._configIdx = scripts.length - 1
					}
				}
			}

			if (this.active[id].label === undefined) {
				this.active[id].label = this.store.db[id].label
			}

			if (typeof this.active[id]._init == 'function') {
				try {
					this.active[id]._init()
				} catch (e) {
					this.system.emit(
						'log',
						'instance(' + this.active[id].label + ')',
						'error',
						'Error initalizing module: ' + e.message
					)
				}
			}
		} catch (e) {
			this.system.emit('log', 'instance(' + id + ')', 'error', 'Instance failed to launch: ' + e.message)
			this.debug('INSTANCE ADD EXCEPTION:', e)
		}
	}

	calculateErrors() {
		this.numError = 0
		this.numWarn = 0
		this.numOk = 0

		// levels: null = unknown, 0 = ok, 1 = warning, 2 = error
		for (const i in this.status) {
			let inn = this.status[i]

			if (inn[0] === 0) {
				this.numOk++
			} else if (inn[0] === 1) {
				this.numWarn++
			} else if (inn[0] === 2) {
				this.numError++
			}
		}

		this.system.emit('instance_errorcount', [this.numOk, this.numWarn, this.numError, this.status])
	}

	checkModuleLoaded(instance_type) {
		let out = false

		if (this.modules[instance_type] === undefined && this.modules_main[instance_type] !== undefined) {
			try {
				let mod = require(this.modules_main[instance_type])
				this.modules[instance_type] = mod
				out = true
			} catch (e) {
				this.debug('Error loading module ' + instance_type, e)
				this.system.emit('log', 'module(' + instance_type + ')', 'error', 'Error loading module: ' + e)
			}
		} else if (this.modules[instance_type] !== undefined) {
			out = true
		}

		return out
	}

	connect(client) {
		client.on('instances_get', () => {
			client.emit('instances_get:result', this.store.db)
		})

		client.on('modules_get', (answer) => {
			sendResult(answer, 'modules_get:result', {
				manufacturer: this.modules_manufacturer,
				category: this.modules_category,
				name: this.modules_name,
				modules: this.store.module,
			})
		})

		client.on('instance_edit', (id, answer) => {
			if (this.active[id] === undefined) {
				return
			}

			const configFields = serializeIsVisibleFn([
				{
					type: 'textinput',
					id: 'label',
					label: 'Label',
					width: 12,
				},
				...(this.active[id].config_fields() || []),
			])

			sendResult(answer, 'instance_edit:result', id, configFields, this.store.db[id])

			if (this.active[id] !== undefined) {
				this.active[id].label = this.store.db[id].label
			}

			this.system.emit('instance_save')
		})

		client.on('instance_config_put', (id, config, answer) => {
			for (const inst in this.store.db) {
				if (inst != id && this.store.db[inst].label == config.label) {
					sendResult(answer, 'instance_config_put:result', 'duplicate label')
					return
				}
			}

			this.system.emit('instance_config_put', id, config)

			sendResult(answer, 'instance_config_put:result', null, 'ok')
		})

		client.on('instance_status_get', () => {
			client.emit('instance_status', this.status)
		})

		client.on('instance_enable', (id, state) => {
			this.system.emit('instance_enable', id, state)

			client.emit('instance_status', this.status)
			client.emit('instances_get:result', this.store.db)
		})

		client.on('instance_delete', (id) => {
			this.system.emit('instance_delete', id, this.active[id] !== undefined ? this.active[id].label : undefined)
		})

		client.on('instance_add', (module, answer) => {
			this.system.emit('instance_add', module, (id) => {
				sendResult(answer, 'instance_add:result', id)
			})
		})

		client.on('instance_get_help_md', (module, answer) => {
			if (this.modules_main[module] !== undefined) {
				const helpPath = this.modules_path[module] + '/HELP.md'

				fs.stat(helpPath, (err, stats) => {
					if (err) {
						this.debug('Error loading help for ' + module, helpPath)
						this.debug(err)
						answer('nofile')
					} else {
						if (stats.isFile()) {
							fs.readFile(helpPath, (err, data) => {
								if (err) {
									this.debug('Error loading help for ' + module, helpPath)
									this.debug(err)
									answer('nofile')
								} else {
									answer(null, {
										markdown: data.toString(),
										baseUrl: '/int/help/' + module + '/',
									})
								}
							})
						} else {
							this.debug('Error loading help for ' + module, helpPath)
							this.debug('Not a file')
							answer('nofile')
						}
					}
				})
			}
		})
	}

	setupModule(folder, path) {
		try {
			let fullpath = path + folder
			this.modules_path[folder] = fullpath
			let packagefile = fs.readFileSync(fullpath + '/package.json')
			let moduleconfig = JSON.parse(packagefile)
			let main = fullpath + '/' + moduleconfig.main
			if (fs.existsSync(fullpath + '/HELP.md')) {
				moduleconfig.help = true
			} else {
				moduleconfig.help = false
			}

			if (moduleconfig.bugs && moduleconfig.bugs.url) {
				moduleconfig.bug_url = moduleconfig.bugs.url
			} else if (moduleconfig.homepage) {
				moduleconfig.bug_url = moduleconfig.homepage
			}

			// Generate manufacturer list
			if (moduleconfig.manufacturer === undefined) {
				throw 'Module ' + folder + " is missing a manufacturer in it's package.json"
			} else if (moduleconfig.name !== 'bitfocus-companion') {
				if (this.modules_manufacturer[moduleconfig.manufacturer] === undefined) {
					this.modules_manufacturer[moduleconfig.manufacturer] = []
				}
				this.modules_manufacturer[moduleconfig.manufacturer].push(folder)
			}

			if (process.env.LOAD_ALL_MODULES !== undefined) {
				let mod = require(fullpath + '/' + moduleconfig.main)
				this.modules[folder] = mod
			}

			this.store.module.push(moduleconfig)
			this.modules_main[folder] = main
			this.package_info[folder] = moduleconfig

			// Generate keywords list
			if (moduleconfig.keywords !== undefined) {
				for (const r in moduleconfig.keywords) {
					let kw = moduleconfig.keywords[r]
					if (this.modules_category[kw] === undefined) {
						this.modules_category[kw] = []
					}
					this.modules_category[kw].push(folder)
				}
			} else {
				console.log(folder, '- uh, no keywords?')
				//process.exit();
			}

			// Add legacy names to the redirect list
			if (moduleconfig.legacy !== undefined) {
				for (const x in moduleconfig.legacy) {
					let from = moduleconfig.legacy[x]
					this.mod_redirects[from] = moduleconfig.name
				}
			}

			// Generate label
			if (moduleconfig.name !== undefined && moduleconfig.name !== 'bitfocus-companion') {
				if (typeof moduleconfig.product == 'string') {
					moduleconfig.label = moduleconfig.manufacturer + ':' + moduleconfig.product
				} else {
					moduleconfig.label = moduleconfig.manufacturer + ':' + moduleconfig.product.join(';')
				}

				this.modules_name[folder] = moduleconfig.label
			}

			// Sanity check
			if (moduleconfig.name != folder) {
				this.debug('ERROR: Module ' + folder + ' identifies itself as ' + moduleconfig.name)
				this.system.emit(
					'log',
					'module(' + folder + ')',
					'error',
					'Module identifies itself as ' + moduleconfig.name + ' and has been disabled.'
				)
				//process.exit();
			} else {
				this.debug('loaded module ' + folder + '@' + moduleconfig.version + ' by ' + moduleconfig.author)
				this.system.emit(
					'log',
					'loaded',
					'debug',
					folder + '@' + moduleconfig.version + ': ' + moduleconfig.label + ' by ' + moduleconfig.author
				)
			}
		} catch (e) {
			this.debug('Error loading module ' + folder, e)
			this.system.emit('log', 'module(' + folder + ')', 'error', 'Error loading module: ' + e)
		}
	}
}

module.exports = Instance
