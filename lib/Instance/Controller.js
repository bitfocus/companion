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
const shortid = require('shortid')
const { rgb, rgbRev, sendResult, serializeIsVisibleFn } = require('../Resources/Util')
const CoreBase = require('../Core/Base')
const InstancePreset = require('./Preset')
const InstanceVariable = require('./Variable')

class Instance extends CoreBase {
	constructor(registry) {
		super(registry, 'instance', 'lib/Instance/Controller')

		this.variable = new InstanceVariable(registry)
		this.preset = new InstancePreset(registry)

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

		this.store.db = this.db.getKey('instance', {})

		// Ensure there is the internal module defined
		this.store.db['bitfocus-companion'] = {
			instance_type: 'bitfocus-companion',
			label: 'internal',
			id: 'bitfocus-companion',
		}

		this.numError = 0
		this.numWarn = 0
		this.numOk = 0

		this.system.on('instance_get_package_info', (instance_type, cb) => {
			this.debug('getting instance_get_package_info for ' + instance_type)
			cb(this.package_info[instance_type])
		})

		// levels: null = unknown, 0 = ok, 1 = warning, 2 = error
		this.system.on('instance_status_update', this.updateInstanceStatus.bind(this))

		this.system.on('instance_config_get', (id, cb) => {
			cb(this.getInstanceConfig(id))
		})

		this.system.on('instance_get', (id, cb) => {
			cb(this.active[id])
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
			this.doSave()
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

		this.system.on('instance_init', () => {
			this.debug('instance_init', this.store.db)

			let module_folders
			let rootDir = require('app-root-path') + '/module-local-dev'

			if (fs.existsSync(rootDir)) {
				module_folders = fs.readdirSync(rootDir)

				if (module_folders.length > 0) {
					for (let i = 0; i < module_folders.length; ++i) {
						let name = module_folders[i]

						if (name == '.gitignore') {
							continue
						} else if (name.match(/companion-module-/)) {
							name = name.substring(17)
							this.loadInfoForModule(name, rootDir + '/companion-module-' + name)
						} else {
							this.loadInfoForModule(name, rootDir + '/' + name)
						}
					}
				}
			}

			rootDir = require('app-root-path') + '/node_modules'
			module_folders = fs.readdirSync(rootDir)

			for (let i = 0; i < module_folders.length; ++i) {
				let name = module_folders[i]

				if (name.match(/companion-module-/)) {
					name = name.substring(17)

					if (this.modules_main[name] !== undefined) {
						this.system.emit(
							'log',
							'module(' + name + ')',
							'warn',
							'Module has been overridden by a local development copy.'
						)
					} else {
						this.loadInfoForModule(name, rootDir + '/companion-module-' + name)
					}
				}
			}

			for (const id in this.store.db) {
				let config = this.store.db[id]

				config.instance_type = this.verifyInstanceTypeIsCurrent(config.instance_type)

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

		// TODO: Implement dependency system
		setTimeout(() => {
			this.system.emit('instance_init')
		}, 2000)

		this.system.emit('instance', this)

		this.system.on('io_connect', this.clientConnect.bind(this))

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
				this.doSave()

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

			this.doSave()
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
					this.updateInstanceStatus(id, null, 'Enabling')
				} else {
					this.updateInstanceStatus(id, -1, 'Disabled')
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

				this.doSave()
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

	/**
	 * Checks whether an instance_type has been renamed
	 * @param {string} instance_type
	 * @returns the instance_type that should be used (often the provided parameter)
	 */
	verifyInstanceTypeIsCurrent(instance_type) {
		return this.mod_redirects[instance_type] || instance_type
	}

	/**
	 * Get information for the metrics system about the current instances
	 */
	getInstancesMetrics() {
		const instancesCounts = {}

		for (const instance_config of Object.values(this.store.db)) {
			if (instance_config.instance_type !== 'bitfocus-companion' && instance_config.enabled !== false) {
				if (instancesCounts[instance_config.instance_type]) {
					instancesCounts[instance_config.instance_type]++
				} else {
					instancesCounts[instance_config.instance_type] = 1
				}
			}
		}

		return instancesCounts
	}

	/**
	 * Stop/destroy all running instances
	 */
	destroyAllInstances() {
		try {
			for (const [instance_id, inst] of Object.entries(this.active)) {
				const label = this.store.db[instance_id].label
				if (label !== 'internal') {
					try {
						inst.destroy()
					} catch (e) {
						console.log('Could not destroy', label)
					}
				}
			}
		} catch (e) {
			console.log('Could not destroy all instances')
		}
	}

	/**
	 * Save the instances config to the db
	 * @access protected
	 */
	doSave() {
		this.db.setKey('instance', this.store.db)
	}

	/**
	 * Get the status of an instance
	 * @param {String} instance_id
	 * @returns
	 */
	getInstanceStatus(instance_id) {
		return this.status[instance_id]
	}

	/**
	 * Get the config object of an instance
	 * @param {String} instance_id
	 * @returns
	 */
	getInstanceConfig(instance_id) {
		return this.store.db[id]
	}

	/**
	 * Update the status of an instance
	 * @param {String} instance_id
	 * @param {number | null} level
	 * @param {String | null} msg
	 */
	updateInstanceStatus(instance_id, level, msg) {
		this.status[instance_id] = [level, msg]
		this.calculateInstanceErrors()

		this.io.emit('instance_status', this.status)
		this.system.emit('instance_status_set', instance_id, level, msg)
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
			actions,
			feedbacks
		)

		// If anything was changed, update system and db
		if (changed) {
			this.system.emit('action_save')
			this.system.emit('feedback_save')
		}
		this.debug('instance save')
		this.doSave()
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

	calculateInstanceErrors() {
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

	clientConnect(client) {
		client.on('instances_get', () => {
			client.emit('instances_get:result', this.store.db)
		})

		client.on('modules_get', (answer) => {
			sendResult(client, answer, 'modules_get:result', {
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

			sendResult(client, answer, 'instance_edit:result', id, configFields, this.store.db[id])

			if (this.active[id] !== undefined) {
				this.active[id].label = this.store.db[id].label
			}

			this.doSave()
		})

		client.on('instance_config_put', (id, config, answer) => {
			for (const inst in this.store.db) {
				if (inst != id && this.store.db[inst].label == config.label) {
					sendResult(client, answer, 'instance_config_put:result', 'duplicate label')
					return
				}
			}

			this.system.emit('instance_config_put', id, config)

			sendResult(client, answer, 'instance_config_put:result', null, 'ok')
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
				sendResult(client, answer, 'instance_add:result', id)
			})
		})

		client.on('instance_get_help_md', (module, answer) => {
			this.getHelpForModule(module)
				.then((res) => {
					if (res) {
						answer(null, res)
					} else {
						answer('nofile')
					}
				})
				.catch((err) => {
					this.debug(`Error loading help for ${module_id}`, helpPath)
					this.debug(err)
					answer('nofile')
				})
		})
	}

	/**
	 * Load the help file for a specified module_id
	 * @param {string} module_id
	 */
	async getHelpForModule(module_id) {
		if (this.modules_path[module_id]) {
			const helpPath = this.modules_path[module_id] + '/HELP.md'

			const stats = await fs.stat(helpPath)
			if (stats.isFile()) {
				const data = await fs.readFile(helpPath)
				return {
					markdown: data.toString(),
					baseUrl: `/int/help/${module_id}/`,
				}
			} else {
				this.debug('Error loading help for ' + module_id, helpPath)
				this.debug('Not a file')
				answer('nofile')
			}
		} else {
			return undefined
		}
	}

	/**
	 * Load information about a module
	 * @abstract private
	 * @param {string} name - Name of the module
	 * @param {string} fullpath - Fullpath to the module
	 */
	loadInfoForModule(name, fullpath) {
		try {
			this.modules_path[name] = fullpath

			const pkgJsonStr = fs.readFileSync(fullpath + '/package.json')
			const moduleconfig = JSON.parse(pkgJsonStr)

			if (moduleconfig.name != name) {
				this.debug(`ERROR: Module ${name} identifies itself as ${moduleconfig.name}`)
				this.system.emit(
					'log',
					`module(${name})`,
					'error',
					`Module identifies itself as ${moduleconfig.name} and has been disabled.`
				)
			} else if (!moduleconfig.manufacturer) {
				this.debug(`ERROR: Module ${name} is missing manufacturer`)
				this.system.emit(
					'log',
					`module(${name})`,
					'error',
					'Module is missing manufacturer information and has been disabled.'
				)
			} else {
				moduleconfig.help = fs.existsSync(fullpath + '/HELP.md')

				if (moduleconfig.bugs && moduleconfig.bugs.url) {
					moduleconfig.bug_url = moduleconfig.bugs.url
				} else if (moduleconfig.homepage) {
					moduleconfig.bug_url = moduleconfig.homepage
				}

				const mainJsPath = fullpath + '/' + moduleconfig.main
				if (process.env.LOAD_ALL_MODULES !== undefined) {
					// Load all modules at startup
					this.modules[name] = require(mainJsPath)
				}

				this.store.module.push(moduleconfig)
				this.modules_main[name] = mainJsPath
				this.package_info[name] = moduleconfig

				if (moduleconfig.name !== 'bitfocus-companion') {
					// Generate manufacturer list
					if (this.modules_manufacturer[moduleconfig.manufacturer] === undefined) {
						this.modules_manufacturer[moduleconfig.manufacturer] = []
					}
					this.modules_manufacturer[moduleconfig.manufacturer].push(name)

					// Generate keywords list
					if (moduleconfig.keywords !== undefined) {
						for (const r in moduleconfig.keywords) {
							let kw = moduleconfig.keywords[r]
							if (this.modules_category[kw] === undefined) {
								this.modules_category[kw] = []
							}
							this.modules_category[kw].push(name)
						}
					} else {
						console.log(name, '- uh, no keywords?')
						//process.exit();
					}

					// Add legacy names to the redirect list
					if (moduleconfig.legacy !== undefined) {
						for (const from of moduleconfig.legacy) {
							this.mod_redirects[from] = moduleconfig.name
						}
					}

					// Generate label
					if (typeof moduleconfig.product == 'string') {
						moduleconfig.label = moduleconfig.manufacturer + ':' + moduleconfig.product
					} else {
						moduleconfig.label = moduleconfig.manufacturer + ':' + moduleconfig.product.join(';')
					}

					this.modules_name[name] = moduleconfig.label
				}

				this.debug(`loaded module ${name}@${moduleconfig.version} by ${moduleconfig.author}`)
				this.system.emit(
					'log',
					`module(${name})`,
					'debug',
					`${name}@${moduleconfig.version}: ${moduleconfig.label} by ${moduleconfig.author}`
				)
			}
		} catch (e) {
			this.debug(`Error loading module ${name}`, e)
			this.system.emit('log', `module(${name})`, 'error', 'Error loading module: ' + e)
		}
	}
}

module.exports = Instance
