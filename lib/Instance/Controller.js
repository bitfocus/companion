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

var debug = require('debug')('Instance/Controller')
var CoreBase = require('../Core/Base')
var shortid = require('shortid')
var fs = require('fs')

class InstanceController extends CoreBase {
	constructor(registry) {
		super(registry, 'instance')

		this.active = {}
		this.modules = {}
		this.modules_manufacturer = {}
		this.modules_category = {}
		this.modules_name = {}
		this.modules_main = {}
		this.modules_path = {}
		this.modules_config = []
		this.package_info = {}
		this.status = {}
		this.mod_redirects = {}

		this.numError = 0
		this.numWarn = 0
		this.numOk = 0

		this.system.on('instance_get_package_info', (cb) => {
			debug('getting instance_get_package_info')
			cb(this.package_info)
		})

		this.system.on('instance_save', () => {
			this.db.setKey('instance', this.instances)
			//this.db.setDirty();
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
			cb(this.instances[id])
		})

		this.system.on('instance_get', (id, cb) => {
			cb(this.active[id])
		})

		this.system.on('instance_getall', (cb) => {
			cb(this.instances, this.active)
		})

		this.system.on('instance_delete', this.deleteInstance.bind(this))

		this.system.on('skeleton-power', this.processPowerState.bind(this))

		this.system.on('instance_init', this.init.bind(this))

		this.instances = this.db.getKey('instance', {})

		// TODO: Implement dependency this.system
		setTimeout(() => {
			this.system.emit('instance_init')
		}, 2000)

		this.system.on('instance_status', (obj) => {
			this.io.emit('instance_status', obj)
		})

		this.system.on('io_connect', (client) => {
			this.clientConnect(client)
		})

		this.system.on('instance_add', this.addInstance.bind(this))

		this.system.on('instance_activate', this.activateModule.bind(this))

		this.system.on('instance_config_put', this.saveInstanceConfig.bind(this))

		this.system.on('instance_enable', this.enableInstance.bind(this))

		this.system.emit('instance', this)
	}

	activateModule(id, modin) {
		var mod

		if (modin !== undefined) {
			mod = modin
		} else if (this.checkModuleLoaded(this.instances[id].instance_type)) {
			mod = this.modules[this.instances[id].instance_type]
		}

		try {
			this.active[id] = new mod(this.system, id, Object.assign({}, this.instances[id]))

			if (this.active[id]._versionscripts !== undefined && this.active[id]._versionscripts.length > 0) {
				// New instances do not need to be upgraded
				this.instances[id]._configIdx = this.active[id]._versionscripts.length - 1
			}

			if (this.active[id].label === undefined) {
				this.active[id].label = this.instances[id].label
			}

			if (typeof this.active[id].upgradeConfig == 'function') {
				this.active[id].upgradeConfig()
			}

			if (typeof this.active[id]._init == 'function') {
				debug('Running _init of ' + id)
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
			debug('INSTANCE ADD EXCEPTION:', e)
		}
	}

	addInstance(data, cb) {
		var module = data.type
		var product = data.product

		if (this.checkModuleLoaded(module)) {
			var mod = this.modules[module]
			var id = shortid.generate()

			this.instances[id] = {}

			this.system.emit('log', 'instance(' + id + ')', 'info', 'instance add ' + module + ' ' + product)

			this.instances[id].instance_type = module
			this.instances[id].product = product

			var label = this.package_info[module].shortname
			var i = 1
			var freename = false

			while (!freename) {
				freename = true
				for (var key in this.instances) {
					if (this.instances[key].label == label) {
						i++
						label = this.package_info[module].shortname + i
						freename = false
						break
					}
				}
			}

			this.instances[id].label = label

			if (this.active[id] !== undefined) {
				this.active[id].label = this.instances[id].label
			}

			this.activateModule(id, mod)

			this.io.emit('instance_get:result', id, this.instances)
			debug('instance_add', id)
			this.system.emit('instance_save')

			if (typeof cb == 'function') {
				cb(id, this.instances[id])
			}
		}
	}

	calculateErrors() {
		this.numError = 0
		this.numWarn = 0
		this.numOk = 0

		// levels: null = unknown, 0 = ok, 1 = warning, 2 = error
		for (var i in this.status) {
			var inn = this.status[i]

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
		var out = false

		if (this.modules[instance_type] === undefined && this.modules_main[instance_type] !== undefined) {
			try {
				var mod = require(this.modules_main[instance_type])
				this.modules[instance_type] = mod
				out = true
			} catch (e) {
				debug('Error loading module ' + instance_type, e)
				this.system.emit('log', 'module(' + instance_type + ')', 'error', 'Error loading module: ' + e)
			}
		} else if (this.modules[instance_type] !== undefined) {
			out = true
		}

		return out
	}

	clientConnect(client) {
		client.on('instances_get', () => {
			client.emit('instances_get:result', this.instances)
		})

		client.on('modules_get', (answer) => {
			answer({
				manufacturer: this.modules_manufacturer,
				category: this.modules_category,
				name: this.modules_name,
				config: this.modules_config,
				modules: this.modules,
			})
		})

		client.on('instance_edit', (id, answer) => {
			if (this.active[id] === undefined) {
				return
			}

			const configFields = [
				{
					type: 'textinput',
					id: 'label',
					label: 'Label',
					width: 12,
				},
				...(this.active[id].config_fields() || []),
			]

			answer(id, this.modules_config, this.instances, configFields, this.instances[id])

			if (this.active[id] !== undefined) {
				this.active[id].label = this.instances[id].label
			}

			this.system.emit('instance_save')
		})

		client.on('instance_config_put', (id, config, answer) => {
			for (var inst in this.instances) {
				if (inst != id && this.instances[inst].label == config.label) {
					answer('duplicate label')
					return
				}
			}

			this.system.emit('instance_config_put', id, config)

			answer(null, 'ok')
		})

		client.on('instance_status_get', () => {
			client.emit('instance_status', this.status)
		})

		client.on('instance_enable', (id, state) => {
			this.system.emit('instance_enable', id, state)

			client.emit('instance_status', this.status)
			client.emit('instances_get:result', this.instances)
		})

		client.on('instance_delete', (id) => {
			this.system.emit('instance_delete', id, this.active[id] !== undefined ? this.active[id].label : undefined)
		})

		client.on('instance_add', (module) => {
			this.system.emit('instance_add', module)
		})

		client.on('instance_get_help_md', function (module, answer) {
			if (this.modules_main[module] !== undefined) {
				const helpPath = this.modules_path[module] + '/HELP.md'

				fs.stat(helpPath, (err, stats) => {
					if (err) {
						debug('Error loading help for ' + module, helpPath)
						debug(err)
						answer('nofile')
					} else {
						if (stats.isFile()) {
							fs.readFile(helpPath, (err, data) => {
								if (err) {
									debug('Error loading help for ' + module, helpPath)
									debug(err)
									answer('nofile')
								} else {
									answer(null, {
										markdown: data.toString(),
										baseUrl: '/int/help/' + module + '/',
									})
								}
							})
						} else {
							debug('Error loading help for ' + module, helpPath)
							debug('Not a file')
							answer('nofile')
						}
					}
				})
			}
		})
	}

	deleteInstance(id) {
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
		delete this.instances[id]

		this.io.emit('instances_get:result', this.store.db)
		this.system.emit('instance_save')
	}

	destroyAll() {
		try {
			for (var key in this.active) {
				if (this.instances[key].label !== 'internal') {
					try {
						if (typeof this.active[key].destroy == 'function') {
							this.active[key].destroy()
						}
					} catch (e) {
						console.log('Could not destroy', this.instances[key].label)
					}
				}
			}
		} catch (e) {
			console.log('Could not destroy all instances')
		}
	}

	enableInstance(id, state) {
		if (this.instances[id].enabled !== state) {
			this.system.emit(
				'log',
				'instance(' + id + ')',
				'info',
				(state ? 'Enable' : 'Disable') + ' instance ' + this.instances[id].label
			)
			this.instances[id].enabled = state

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
				this.activateModule(id)
			}

			this.system.emit('instance_save')
		} else {
			if (state === true) {
				this.system.emit('log', 'instance(' + id + ')', 'warn', 'Attempting to enable module that is alredy enabled')
			} else {
				this.system.emit('log', 'instance(' + id + ')', 'warn', 'Attempting to disable module that is alredy disabled')
			}
		}
	}

	getInstance(id) {
		let out = {}

		if (this.active[id] !== undefined && this.isInstanceEnabled(id) === true) {
			out = this.active[id]
		}

		return out
	}

	getInstanceConfig(id) {
		let out = {}

		if (this.instances[id] !== undefined) {
			out = this.instances[id]
		}

		return out
	}

	getInstanceStatus(id) {
		let out

		if (this.status[id] !== undefined) {
			out = this.status[id]
		}

		return out
	}

	init() {
		debug('instance_init', this.instances)

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

		if (this.instances['bitfocus-companion'] === undefined) {
			this.instances['bitfocus-companion'] = {
				instance_type: 'bitfocus-companion',
				label: 'internal',
				id: 'bitfocus-companion',
			}
		} else if (this.instances['bitfocus-companion'] !== undefined) {
			// Bugfix of corrupted configs
			if (this.instances['bitfocus-companion'].id === undefined) {
				this.instances['bitfocus-companion'].id = 'bitfocus-companion'
			}
		}

		for (var id in this.instances) {
			var config = this.instances[id]

			if (this.mod_redirects[config.instance_type] !== undefined) {
				config.instance_type = this.mod_redirects[config.instance_type]
			}

			if (config.enabled === false) {
				debug("Won't load disabled module " + id + ' (' + config.instance_type + ')')
			} else if (this.checkModuleLoaded(config.instance_type)) {
				var mod = this.modules[config.instance_type]
				this.activateModule(id, mod)
			} else {
				debug('Configured instance ' + config.instance_type + ' could not be loaded, unknown module')

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
	}

	isInstanceEnabled(id) {
		var out

		if (this.instances[id] !== undefined && this.instances[id].enabled !== false) {
			out = true
		} else if (this.instances[id] !== undefined) {
			out = false
		}

		return out
	}

	processPowerState(event) {
		if (event == 'resume') {
			this.system.emit('log', 'this.system(power)', 'info', 'Resuming')

			for (var id in this.active) {
				this.system.emit('log', 'instance(' + this.active[id].label + ')', 'debug', 'Bringing back instance from sleep')
				this.activateModule(id)
			}
		} else if (event == 'suspend') {
			this.system.emit('log', 'this.system(power)', 'info', 'Suspending')

			for (var id in this.active) {
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
	}

	saveInstanceConfig(id, config, internal) {
		for (var key in config) {
			this.instances[id][key] = config[key]
		}

		if (this.active[id] !== undefined) {
			if (this.active[id].label != this.instances[id].label) {
				this.system.emit('variable_instance_label_rename', this.active[id].label, this.instances[id].label, id)
			}

			this.active[id].label = this.instances[id].label
		}

		this.system.emit('instance_save')
		this.io.emit('instances_get:result', this.instances)

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
	}

	setupModule(folder, path) {
		try {
			var fullpath = path + folder
			this.modules_path[folder] = fullpath
			var packagefile = fs.readFileSync(fullpath + '/package.json')
			var moduleconfig = JSON.parse(packagefile)
			var main = fullpath + '/' + moduleconfig.main
			if (fs.existsSync(fullpath + '/HELP.md')) {
				moduleconfig.help = true
			} else {
				moduleconfig.help = false
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
				var mod = require(fullpath + '/' + moduleconfig.main)
				this.modules[folder] = mod
			}

			this.store.module.push(moduleconfig)
			this.modules_main[folder] = main
			this.package_info[folder] = moduleconfig

			// Generate keywords list
			if (moduleconfig.keywords !== undefined) {
				for (var r in moduleconfig.keywords) {
					var kw = moduleconfig.keywords[r]
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
				for (var x in moduleconfig.legacy) {
					var from = moduleconfig.legacy[x]
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
				debug('ERROR: Module ' + folder + ' identifies itself as ' + moduleconfig.name)
				this.system.emit(
					'log',
					'module(' + folder + ')',
					'error',
					'Module identifies itself as ' + moduleconfig.name + ' and has been disabled.'
				)
				//process.exit();
			} else {
				debug('loaded module ' + folder + '@' + moduleconfig.version + ' by ' + moduleconfig.author)
				this.system.emit(
					'log',
					'loaded',
					'debug',
					folder + '@' + moduleconfig.version + ': ' + moduleconfig.label + ' by ' + moduleconfig.author
				)
			}
		} catch (e) {
			debug('Error loading module ' + folder, e)
			this.system.emit('log', 'module(' + folder + ')', 'error', 'Error loading module: ' + e)
		}
	}
}

exports = module.exports = InstanceController
