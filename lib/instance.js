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

var debug = require('debug')('lib/instance')
var shortid = require('shortid')
var fs = require('fs')
var image = require('./image')

function instance(system) {
	var self = this

	self.system = system
	self.active = {}
	self.modules = {}
	self.modules_manufacturer = {}
	self.modules_category = {}
	self.modules_name = {}
	self.modules_main = {}
	self.modules_path = {}
	self.package_info = {}
	self.status = {}
	self.mod_redirects = {}

	self.store = {
		module: [],
		db: {},
	}

	self.numError = 0
	self.numWarn = 0
	self.numOk = 0

	system.on('instance_get_package_info', function (cb) {
		debug('getting instance_get_package_info')
		cb(self.package_info)
	})

	system.on('instance_save', function () {
		system.emit('db_set', 'instance', self.store.db)
		system.emit('db_save')
	})

	// levels: null = unknown, 0 = ok, 1 = warning, 2 = error
	system.on('instance_status_update', function (instance, level, msg) {
		self.status[instance] = [level, msg]
		self.calculateErrors()
		system.emit('instance_status', self.status)
		system.emit('instance_status_set', instance, level, msg)
	})

	system.on('instance_status_get', function (instance, cb) {
		cb(self.status[instance])
	})

	system.on('instance_config_get', function (id, cb) {
		cb(self.store.db[id])
	})

	system.on('instance_get', function (id, cb) {
		cb(self.active[id])
	})

	system.on('instance_getall', function (cb) {
		cb(self.store.db, self.active)
	})

	system.on('instance_delete', function (id) {
		self.system.emit('log', 'instance(' + id + ')', 'info', 'instance deleted')

		if (self.active[id] !== undefined) {
			if (self.active[id].destroy !== undefined && typeof self.active[id].destroy == 'function') {
				try {
					self.active[id].destroy()
				} catch (e) {
					self.system.emit('log', 'instance(' + id + ')', 'debug', 'Error while deleting instance: ' + e.message)
				}
			}

			delete self.active[id]
		}
		delete self.status[id]
		delete self.store.db[id]

		self.io.emit('instances_get:result', self.store.db)
		self.system.emit('instance_save')
	})

	system.on('skeleton-power', function (event) {
		if (event == 'resume') {
			self.system.emit('log', 'system(power)', 'info', 'Resuming')

			for (var id in self.active) {
				self.system.emit('log', 'instance(' + self.active[id].label + ')', 'debug', 'Bringing back instance from sleep')
				self.activate_module(id)
			}
		} else if (event == 'suspend') {
			self.system.emit('log', 'system(power)', 'info', 'Suspending')

			for (var id in self.active) {
				if (
					self.active[id] !== undefined &&
					self.active[id].destroy !== undefined &&
					typeof self.active[id].destroy == 'function'
				) {
					try {
						self.active[id].destroy()
					} catch (e) {
						self.system.emit(
							'log',
							'instance(' + self.active[id].label + ')',
							'debug',
							'Error suspending instance: ' + e.message
						)
					}
				}
			}
		}
	})

	self.system.on('http_req', function (req, res, done) {
		var match

		if ((match = req.url.match(/^\/help\/([^/]+)\/(.+?)(\?.+)?$/))) {
			var module = match[1].replace(/\.\.+/g, '')
			var file = match[2].replace(/\.\.+/g, '')
			var path = self.modules_path[module]

			if (file.match(/\.(jpe?g|gif|png|pdf)$/) && fs.existsSync(path + '/' + file)) {
				done()
				res.sendFile(path + '/' + file)
			}
		}
	})

	system.on('module_redirect', function (name, cb) {
		cb(self.mod_redirects[name])
	})

	system.on('instance_init', function () {
		debug('instance_init', self.store.db)

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
						self.setupModule(folder, path + '/companion-module-')
					} else {
						self.setupModule(folder, path + '/')
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

				if (self.modules_main[folder] !== undefined) {
					self.system.emit(
						'log',
						'module(' + folder + ')',
						'warn',
						'Module has been overridden by a local development copy.'
					)
				} else {
					self.setupModule(folder, path + '/companion-module-')
				}
			}
		}

		if (self.store.db['bitfocus-companion'] === undefined) {
			self.store.db['bitfocus-companion'] = {
				instance_type: 'bitfocus-companion',
				label: 'internal',
				id: 'bitfocus-companion',
			}
		}
		// Bugfix of corrupted configs
		else if (self.store.db['bitfocus-companion'] !== undefined) {
			if (self.store.db['bitfocus-companion'].id === undefined) {
				self.store.db['bitfocus-companion'].id = 'bitfocus-companion'
			}
		}

		for (var id in self.store.db) {
			var config = self.store.db[id]

			if (self.mod_redirects[config.instance_type] !== undefined) {
				config.instance_type = self.mod_redirects[config.instance_type]
			}

			if (self.checkModuleLoaded(config.instance_type)) {
				var mod = self.modules[config.instance_type]

				self.upgrade_instance_config(id, config.instance_type, config)

				if (config.enabled === false) {
					debug("Won't load disabled module " + id + ' (' + config.instance_type + ')')
					continue
				}

				self.active[id] = new mod(self.system, id, Object.assign({}, config))
				self.active[id].label = config.label

				if (typeof self.active[id]._init == 'function') {
					debug('Running _init of ' + id)
					try {
						self.active[id]._init()
					} catch (e) {
						self.system.emit(
							'log',
							'instance(' + self.active[id].label + ')',
							'warn',
							'Error initalizing module: ' + e.message
						)
					}
				}
			} else {
				debug('Configured instance ' + config.instance_type + ' could not be loaded, unknown module')
				if (config.instance_type != 'bitfocus-companion') {
					system.emit(
						'log',
						'instance(' + config.instance_type + ')',
						'error',
						'Configured instance ' + config.instance_type + ' could not be loaded, unknown module'
					)
				}
			}
		}

		system.emit('instances_loaded')
	})

	system.on(
		'instance_upgrade_imported',
		function (instance_id, instance_created, instance_type, imported_config, actions, feedbacks) {
			if (self.checkModuleLoaded(instance_type)) {
				const mod = self.modules[instance_type]

				self.upgrade_instance_config_partial(
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

	system.emit('db_get', 'instance', function (res) {
		if (res === undefined) {
			self.store.db = {}
			system.emit('db_set', 'instance', self.store.db)
			system.emit('db_save')
		} else {
			self.store.db = res
		}

		// TODO: Implement dependency system
		setTimeout(function () {
			system.emit('instance_init')
		}, 2000)
	})

	system.emit('instance', self)

	system.emit('io_get', function (io) {
		self.io = io

		system.on('instance_status', function (obj) {
			io.emit('instance_status', obj)
		})

		system.on('io_connect', function (client) {
			self.connect(client)
		})
	})

	system.on('instance_add', function (data, cb, disabled) {
		var module = data.type
		var product = data.product

		if (self.checkModuleLoaded(module)) {
			var mod = self.modules[module]
			var id = shortid.generate()

			self.store.db[id] = {}

			self.system.emit('log', 'instance(' + id + ')', 'info', 'instance add ' + module + ' ' + product)

			self.store.db[id].instance_type = module
			self.store.db[id].product = product

			var label = self.package_info[module].shortname
			var i = 1
			var freename = false

			while (!freename) {
				freename = true
				for (var key in self.store.db) {
					if (self.store.db[key].label == label) {
						i++
						label = self.package_info[module].shortname + i
						freename = false
						break
					}
				}
			}

			self.store.db[id].label = label
			if (self.active[id] !== undefined) {
				self.active[id].label = self.store.db[id].label
			}

			if (disabled) {
				self.store.db[id].enabled = false
			}

			self.activate_module(id, mod, true)

			self.io.emit('instances_get:result', self.store.db)
			debug('instance_add', id)
			self.system.emit('instance_save')
			self.system.emit('actions_update')
			self.system.emit('feedback_update')

			if (typeof cb == 'function') {
				cb(id, self.store.db[id])
			}
		}
	})

	system.on('instance_activate', function (id) {
		self.activate_module(id)
	})

	system.on('instance_config_put', function (id, config, internal) {
		for (var key in config) {
			self.store.db[id][key] = config[key]
		}

		if (self.active[id] !== undefined) {
			if (self.active[id].label != self.store.db[id].label) {
				system.emit('variable_instance_label_rename', self.active[id].label, self.store.db[id].label, id)
			}

			self.active[id].label = self.store.db[id].label
		}

		self.system.emit('instance_save')
		self.io.emit('instances_get:result', self.store.db)

		if (!internal && self.active[id] !== undefined) {
			if (typeof self.active[id].updateConfig == 'function') {
				try {
					self.active[id].updateConfig(Object.assign({}, config))
				} catch (e) {
					self.system.emit(
						'log',
						'instance(' + self.active[id].label + ')',
						'warn',
						'Error updating instance configuration: ' + e.message
					)
				}
			}
		}

		self.system.emit('log', 'instance(' + id + ')', 'debug', 'instance configuration updated')
	})

	system.on('instance_enable', function (id, state) {
		if (self.store.db[id].enabled !== state) {
			self.system.emit(
				'log',
				'instance(' + id + ')',
				'info',
				(state ? 'Enable' : 'Disable') + ' instance ' + self.store.db[id].label
			)
			self.store.db[id].enabled = state

			if (state === true) {
				system.emit('instance_status_update', id, null, 'Enabling')
			} else {
				system.emit('instance_status_update', id, -1, 'Disabled')
			}

			if (state === false) {
				if (
					self.active[id] !== undefined &&
					self.active[id].destroy !== undefined &&
					typeof self.active[id].destroy == 'function'
				) {
					try {
						self.active[id].destroy()
					} catch (e) {
						self.system.emit('log', 'instance(' + id + ')', 'warn', 'Error disabling instance: ' + e.message)
					}
					delete self.active[id]
				}
			} else {
				self.activate_module(id)
			}

			self.system.emit('instance_save')
		} else {
			if (state === true) {
				self.system.emit('log', 'instance(' + id + ')', 'warn', 'Attempting to enable module that is alredy enabled')
			} else {
				self.system.emit('log', 'instance(' + id + ')', 'warn', 'Attempting to disable module that is alredy disabled')
			}
		}
	})

	return self
}

instance.prototype.upgrade_instance_config = function (id, instance_type) {
	var self = this

	const mod = self.modules[instance_type]
	if (!mod || mod.GetUpgradeScripts === undefined) {
		return
	}

	// Fetch instance actions
	var actions = []
	self.system.emit('actions_for_instance', id, function (_actions) {
		actions = _actions
	})
	var release_actions = []
	self.system.emit('release_actions_for_instance', id, function (_release_actions) {
		release_actions = _release_actions
	})
	var feedbacks = []
	self.system.emit('feedbacks_for_instance', id, function (_feedbacks) {
		feedbacks = _feedbacks
	})

	const config = self.store.db[id]
	const changed = self.upgrade_instance_config_partial(
		id,
		instance_type,
		config._configIdx,
		config,
		[...actions, ...release_actions],
		feedbacks
	)

	// If anything was changed, update system and db
	if (changed) {
		self.system.emit('action_save')
		self.system.emit('feedback_save')
	}
	debug('instance save')
	self.system.emit('instance_save')
}

instance.prototype.upgrade_instance_config_partial = function (
	id,
	instance_type,
	from_idx,
	upgrade_config,
	actions,
	feedbacks
) {
	var self = this

	const package_info = self.package_info[instance_type]
	const package_name = package_info ? package_info.name : instance_type
	var debug = require('debug')('instance/' + package_name + '/' + id)

	debug(`upgrade_instance_config_partial(${package_name}): starting`)

	const mod = self.modules[instance_type]
	if (!package_info || !mod || mod.GetUpgradeScripts === undefined) {
		debug(`upgrade_instance_config_partial(${package_name}): nothing to do`)
		return
	}

	var idx = from_idx
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
			convert15to32: function (bank) {
				let new_bank = bank
				system.emit('bank_get15to32', bank, function (_bank) {
					new_bank = _bank
				})
				return new_bank
			},
			rgb: image.rgb,
			rgbRev: image.rgbRev,
		}

		let changed = false
		for (var i = idx + 1; i < upgrade_scripts.length; ++i) {
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
			self.system.emit('instance_config_put', id, upgrade_config, true)
		}

		return changed
	} else {
		return false
	}
}

instance.prototype.activate_module = function (id, modin, is_being_created) {
	var self = this
	var mod

	if (modin !== undefined) {
		mod = modin
	} else if (self.checkModuleLoaded(self.store.db[id].instance_type)) {
		mod = self.modules[self.store.db[id].instance_type]
	}

	try {
		self.active[id] = new mod(self.system, id, Object.assign({}, self.store.db[id]))

		if (is_being_created && self.store.db[id]._configIdx === undefined) {
			// New instances do not need to be upgraded
			if (mod.GetUpgradeScripts !== undefined) {
				const scripts = mod.GetUpgradeScripts()
				if (scripts !== undefined && scripts.length > 0) {
					self.store.db[id]._configIdx = scripts.length - 1
				}
			}
		}

		if (self.active[id].label === undefined) {
			self.active[id].label = self.store.db[id].label
		}

		if (typeof self.active[id]._init == 'function') {
			try {
				self.active[id]._init()
			} catch (e) {
				self.system.emit(
					'log',
					'instance(' + self.active[id].label + ')',
					'error',
					'Error initalizing module: ' + e.message
				)
			}
		}
	} catch (e) {
		self.system.emit('log', 'instance(' + id + ')', 'error', 'Instance failed to launch: ' + e.message)
		debug('INSTANCE ADD EXCEPTION:', e)
	}
}

instance.prototype.calculateErrors = function () {
	var self = this

	self.numError = 0
	self.numWarn = 0
	self.numOk = 0

	// levels: null = unknown, 0 = ok, 1 = warning, 2 = error
	for (var i in self.status) {
		var inn = self.status[i]

		if (inn[0] === 0) {
			self.numOk++
		} else if (inn[0] === 1) {
			self.numWarn++
		} else if (inn[0] === 2) {
			self.numError++
		}
	}

	self.system.emit('instance_errorcount', [self.numOk, self.numWarn, self.numError, self.status])
}

instance.prototype.checkModuleLoaded = function (instance_type) {
	var self = this
	var out = false

	if (self.modules[instance_type] === undefined && self.modules_main[instance_type] !== undefined) {
		try {
			var mod = require(self.modules_main[instance_type])
			self.modules[instance_type] = mod
			out = true
		} catch (e) {
			debug('Error loading module ' + instance_type, e)
			self.system.emit('log', 'module(' + instance_type + ')', 'error', 'Error loading module: ' + e)
		}
	} else if (self.modules[instance_type] !== undefined) {
		out = true
	}

	return out
}

instance.prototype.connect = function (client) {
	var self = this

	function sendResult(answer, name, ...args) {
		if (typeof answer === 'function') {
			answer(...args)
		} else {
			client.emit(name, ...args)
		}
	}

	client.on('instances_get', function () {
		client.emit('instances_get:result', self.store.db)
	})

	client.on('modules_get', function (answer) {
		sendResult(answer, 'modules_get:result', {
			manufacturer: self.modules_manufacturer,
			category: self.modules_category,
			name: self.modules_name,
			modules: self.store.module,
		})
	})

	client.on('instance_edit', function (id, answer) {
		if (self.active[id] === undefined) {
			return
		}

		const configFields = [
			{
				type: 'textinput',
				id: 'label',
				label: 'Label',
				width: 12,
			},
			...(self.active[id].config_fields() || []),
		].map((field) => {
			// serialize `isVisible` if it exists
			if (typeof field.isVisible === 'function') {
				return {
					...field,
					isVisible: field.isVisible.toString(),
				}
			}
			return field
		})

		sendResult(answer, 'instance_edit:result', id, configFields, self.store.db[id])

		if (self.active[id] !== undefined) {
			self.active[id].label = self.store.db[id].label
		}

		self.system.emit('instance_save')
	})

	client.on('instance_config_put', function (id, config, answer) {
		for (var inst in self.store.db) {
			if (inst != id && self.store.db[inst].label == config.label) {
				sendResult(answer, 'instance_config_put:result', 'duplicate label')
				return
			}
		}

		self.system.emit('instance_config_put', id, config)

		sendResult(answer, 'instance_config_put:result', null, 'ok')
	})

	client.on('instance_status_get', function () {
		client.emit('instance_status', self.status)
	})

	client.on('instance_enable', function (id, state) {
		self.system.emit('instance_enable', id, state)

		client.emit('instance_status', self.status)
		client.emit('instances_get:result', self.store.db)
	})

	client.on('instance_delete', function (id) {
		self.system.emit('instance_delete', id, self.active[id] !== undefined ? self.active[id].label : undefined)
	})

	client.on('instance_add', function (module, answer) {
		self.system.emit('instance_add', module, function (id) {
			sendResult(answer, 'instance_add:result', id)
		})
	})

	client.on('instance_get_help_md', function (module, answer) {
		if (self.modules_main[module] !== undefined) {
			const helpPath = self.modules_path[module] + '/HELP.md'

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

instance.prototype.setupModule = function (folder, path) {
	var self = this

	try {
		var fullpath = path + folder
		self.modules_path[folder] = fullpath
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
			if (self.modules_manufacturer[moduleconfig.manufacturer] === undefined) {
				self.modules_manufacturer[moduleconfig.manufacturer] = []
			}
			self.modules_manufacturer[moduleconfig.manufacturer].push(folder)
		}

		if (process.env.LOAD_ALL_MODULES !== undefined) {
			var mod = require(fullpath + '/' + moduleconfig.main)
			self.modules[folder] = mod
		}

		self.store.module.push(moduleconfig)
		self.modules_main[folder] = main
		self.package_info[folder] = moduleconfig

		// Generate keywords list
		if (moduleconfig.keywords !== undefined) {
			for (var r in moduleconfig.keywords) {
				var kw = moduleconfig.keywords[r]
				if (self.modules_category[kw] === undefined) {
					self.modules_category[kw] = []
				}
				self.modules_category[kw].push(folder)
			}
		} else {
			console.log(folder, '- uh, no keywords?')
			//process.exit();
		}

		// Add legacy names to the redirect list
		if (moduleconfig.legacy !== undefined) {
			for (var x in moduleconfig.legacy) {
				var from = moduleconfig.legacy[x]
				self.mod_redirects[from] = moduleconfig.name
			}
		}

		// Generate label
		if (moduleconfig.name !== undefined && moduleconfig.name !== 'bitfocus-companion') {
			if (typeof moduleconfig.product == 'string') {
				moduleconfig.label = moduleconfig.manufacturer + ':' + moduleconfig.product
			} else {
				moduleconfig.label = moduleconfig.manufacturer + ':' + moduleconfig.product.join(';')
			}

			self.modules_name[folder] = moduleconfig.label
		}

		// Sanity check
		if (moduleconfig.name != folder) {
			debug('ERROR: Module ' + folder + ' identifies itself as ' + moduleconfig.name)
			self.system.emit(
				'log',
				'module(' + folder + ')',
				'error',
				'Module identifies itself as ' + moduleconfig.name + ' and has been disabled.'
			)
			//process.exit();
		} else {
			debug('loaded module ' + folder + '@' + moduleconfig.version + ' by ' + moduleconfig.author)
			self.system.emit(
				'log',
				'loaded',
				'debug',
				folder + '@' + moduleconfig.version + ': ' + moduleconfig.label + ' by ' + moduleconfig.author
			)
		}
	} catch (e) {
		debug('Error loading module ' + folder, e)
		self.system.emit('log', 'module(' + folder + ')', 'error', 'Error loading module: ' + e)
	}
}

exports = module.exports = function (system) {
	return new instance(system)
}
