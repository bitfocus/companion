const instance_skel = require('../../instance_skel')
const os = require('os')
const exec = require('child_process').exec
const GetUpgradeScripts = require('./upgrades')
const _ = require('underscore')

instance.prototype.init = function () {
	let self = this

	self.instances = {}
	self.pageHistory = {}

	self.feedback_variable_subscriptions = {}

	self.CHOICES_INSTANCES = []

	self.BUTTON_ACTIONS = [
		'button_pressrelease',
		'button_press',
		'button_release',
		'button_text',
		'textcolor',
		'bgcolor',
		'panic_bank',
	]

	self.bind_ip_get()
	self.addSystemCallback('ip_rebind', self.bind_ip_get.bind(self))

	self.instance_save()
	self.addSystemCallback('instance_save', self.instance_save.bind(self))

	self.addSystemCallback('variables_changed', self.variables_changed.bind(self))

	self.update_variables()

	self.subscribeFeedbacks('variable_value')
	self.subscribeFeedbacks('variable_variable')

	self.status(self.STATE_OK)
}

instance.prototype.bind_ip_get = function () {
	let self = this
	let adapters = getNetworkInterfaces.apply(self)
	let ip = ''

	const new_values = {}

	for (let i in adapters) {
		new_values[adapters[i].name] = adapters[i].address
		ip += adapters[i].address + '\\n'
	}

	new_values['all_ip'] = ip
	self.setVariables(new_values)

	self.system.emit('config_get', 'bind_ip', function (bind_ip) {
		self.setVariable('bind_ip', bind_ip)
	})
}

instance.prototype.bank_invalidate = function (page, bank) {
	if (oldText !== newText) {
		self.setVariable(variableId, newText)
	}
}

instance.prototype.variables_changed = function (changed_variables, removed_variables) {
	let self = this

	const all_changed_variables = new Set([...removed_variables, ...Object.keys(changed_variables)])

	let affected_ids = []

	for (const [id, names] of Object.entries(self.feedback_variable_subscriptions)) {
		for (const name of names) {
			if (all_changed_variables.has(name)) {
				affected_ids.push(id)
				break
			}
		}
	}

	if (affected_ids.length > 0) {
		self.checkFeedbacksById(...affected_ids)
	}
}

instance.prototype.instance_save = function () {
	let self = this

	self.system.emit('instance_getall', self.instance_getall.bind(self))
}

instance.prototype.instance_getall = function (instances) {
	let self = this
	self.instances = instances
	self.CHOICES_INSTANCES.length = 0

	for (let key in self.instances) {
		if (self.instances[key].label !== 'internal') {
			self.CHOICES_INSTANCES.push({ label: self.instances[key].label, id: key })
		}
	}

	self.init_actions()

	self.init_feedback()
}

instance.prototype.init_actions = function (system) {
	let self = this

	actions = {
		instance_control: {
			label: 'Enable or disable instance',
			options: [
				{
					type: 'dropdown',
					label: 'Instance',
					id: 'instance_id',
					default: self.CHOICES_INSTANCES.length > 0 ? self.CHOICES_INSTANCES[0].id : undefined,
					choices: self.CHOICES_INSTANCES,
				},
				{
					type: 'dropdown',
					label: 'Enable',
					id: 'enable',
					default: 'true',
					choices: self.CHOICES_YESNO_BOOLEAN,
				},
			],
		},

		lockout_device: {
			label: 'Trigger a device to lockout immediately.',
			options: [
				{
					type: 'dropdown',
					label: 'Surface / controller',
					id: 'controller',
					default: 'self',
					choices: self.CHOICES_SURFACES,
				},
			],
		},
		unlockout_device: {
			label: 'Trigger a device to unlock immediately.',
			options: [
				{
					type: 'dropdown',
					label: 'Surface / controller',
					id: 'controller',
					default: 'self',
					choices: self.CHOICES_SURFACES,
				},
			],
		},
		exec: {
			label: 'Run shell path (local)',
			options: [
				{
					type: 'textinput',
					label: 'Path (supports variables in path)',
					id: 'path',
				},
				{
					type: 'number',
					label: 'Timeout (ms, between 500 and 20000)',
					id: 'timeout',
					default: 5000,
					min: 500,
					max: 20000,
					required: true,
				},
			],
		},
		lockout_all: {
			label: 'Trigger all devices to lockout immediately.',
		},
		unlockout_all: {
			label: 'Trigger all devices to unlock immediately.',
		},

		rescan: {
			label: 'Rescan USB for devices',
		},

		panic_bank: {
			label: 'Abort actions on button',
			options: [
				{
					type: 'dropdown',
					label: 'Page',
					tooltip: 'What page is the button on?',
					id: 'page',
					default: '0',
					choices: self.CHOICES_PAGES,
				},
				{
					type: 'dropdown',
					label: 'Bank',
					tooltip: 'Which Button?',
					id: 'bank',
					default: '0',
					choices: self.CHOICES_BANKS,
				},
				{
					type: 'checkbox',
					label: 'Unlatch?',
					id: 'unlatch',
					default: false,
				},
			],
		},

		panic: {
			label: 'Abort all delayed actions',
		},

		app_exit: {
			label: 'Kill companion',
		},
	}

	if (self.system.listenerCount('restart') > 0) {
		// Only offer app_restart if there is a handler for the event
		actions['app_restart'] = {
			label: 'Restart companion',
		}
	}

	self.system.emit('instance_actions', self.id, actions)
}

instance.prototype.action = function (action, extras) {
	let self = this
	let id = action.action
	let opt = action.options
	let thePage = opt.page
	let theBank = opt.bank
	let theController = opt.controller

	if (extras) {
		if (self.BUTTON_ACTIONS.includes(id)) {
			if (0 == opt.bank) {
				// 'this' button
				//			thePage = extras.page;
				theBank = extras.bank
			}
			if (0 == opt.page) {
				// 'this' page
				thePage = extras.page
			}
		} else if (self.PAGE_ACTIONS.includes(id)) {
			if (0 == opt.page) {
				// 'this' page
				thePage = extras.page
			}
		}

		if (theController == 'self') {
			theController = extras.deviceid
		}
	}

	// get userconfig object
	self.system.emit('get_userconfig', function (userconfig) {
		self.userconfig = userconfig
	})
	if (id == 'instance_control') {
		self.system.emit('instance_enable', opt.instance_id, opt.enable == 'true')
	} else if (id == 'lockout_device') {
		if (self.userconfig.pin_enable) {
			// Change page after this runloop
			if (extras) {
				self.system.emit('bank_pressed', extras.page, extras.bank, false, theController)
			}
			setImmediate(function () {
				if (self.userconfig.link_lockouts) {
					self.system.emit('lockoutall')
				} else {
					self.system.emit('lockout_device', theController, opt.page)
				}
			})
		}
	} else if (id == 'unlockout_device') {
		if (self.userconfig.pin_enable) {
			// Change page after this runloop
			if (extras) {
				self.system.emit('bank_pressed', extras.page, extras.bank, false, theController)
			}
			setImmediate(function () {
				if (self.userconfig.link_lockouts) {
					self.system.emit('unlockoutall')
				} else {
					self.system.emit('unlockout_device', theController, opt.page)
				}
			})
		}
	} else if (id == 'lockout_all') {
		if (self.userconfig.pin_enable) {
			if (extras) {
				self.system.emit('bank_pressed', extras.page, extras.bank, false, surface)
			}
			setImmediate(function () {
				self.system.emit('lockoutall')
			})
		}
	} else if (id == 'unlockout_all') {
		if (self.userconfig.pin_enable) {
			if (extras) {
				self.system.emit('bank_pressed', extras.page, extras.bank, false, surface)
			}
			setImmediate(function () {
				self.system.emit('unlockoutall')
			})
		}
	} else if (id == 'panic') {
		self.system.emit('action_delayed_abort')
	} else if (id == 'panic_bank') {
		self.system.emit('action_abort_bank', thePage, theBank, opt.unlatch)
	} else if (id == 'rescan') {
		self.system.emit('devices_reenumerate')
	} else if (id == 'exec') {
		if (opt.path !== undefined) {
			let path = opt.path
			self.parseVariables(path, function (value) {
				path = value
			})
			self.debug("Running path: '" + path + "'")
			exec(
				path,
				{
					timeout: opt.timeout === undefined ? 5000 : opt.timeout,
				},
				function (error, stdout, stderr) {
					if (error) {
						self.log('error', 'Shell command failed. Guru meditation: ' + JSON.stringify(error))
						self.debug(error)
					}
				}
			)
		}
	} else if (id == 'app_exit') {
		self.system.emit('exit')
	} else if (id == 'app_restart') {
		self.system.emit('restart')
	}
}

function getNetworkInterfaces() {
	let self = this
	let interfaces = []
	const networkInterfaces = os.networkInterfaces()

	for (const interface in networkInterfaces) {
		let numberOfAddresses = networkInterfaces[interface].length
		let v4Addresses = []
		let iface = interface.split(' ')[0]

		for (let i = 0; i < numberOfAddresses; i++) {
			if (networkInterfaces[interface][i]['family'] === 'IPv4') {
				v4Addresses.push(networkInterfaces[interface][i].address)
			}
		}
		numV4s = v4Addresses.length
		for (let i = 0; i < numV4s; i++) {
			let aNum = numV4s > 1 ? `:${i}` : ''
			interfaces.push({
				label: `${interface}${aNum}`,
				name: `${iface}${aNum}`,
				address: v4Addresses[i],
			})
		}
	}
	self.adapters = interfaces

	return interfaces
}

instance.prototype.update_variables = function () {
	let self = this
	let variables = []
	let adapters = self.adapters

	if (adapters == undefined) {
		adapters = getNetworkInterfaces.apply(self)
	}

	for (let i in adapters) {
		variables.push({
			label: `${adapters[i].label} IP Address`,
			name: adapters[i].name,
		})
	}

	variables.push({
		label: 'IP of attached network interface',
		name: 'bind_ip',
	})

	variables.push({
		label: 'IP of all network interfaces',
		name: 'all_ip',
	})

	variables.push({
		label: 'T-bar position',
		name: 't-bar',
	})

	variables.push({
		label: 'Shuttle position',
		name: 'shuttle',
	})

	variables.push({
		label: 'Jog position',
		name: 'jog',
	})

	for (const [name, info] of Object.entries(self.custom_variables)) {
		variables.push({
			label: info.description,
			name: `custom_${name}`,
		})
	}

	self.setVariableDefinitions(variables)

	self.setVariables({
		't-bar': '0',
		jog: '0',
		shuttle: '0',
	})
}

instance.prototype.init_feedback = function () {
	let self = this

	let feedbacks = {}

	feedbacks['variable_value'] = {
		type: 'boolean',
		label: 'Check variable value',
		description: 'Change style based on the value of a variable',
		style: {
			color: self.rgb(255, 255, 255),
			bgcolor: self.rgb(255, 0, 0),
		},
		options: [
			{
				type: 'dropdown',
				label: 'Variable',
				tooltip: 'What variable to act on?',
				id: 'variable',
				default: 'internal:time_hms',
				choices: self.CHOICES_VARIABLES,
			},
			{
				type: 'dropdown',
				label: 'Operation',
				id: 'op',
				default: 'eq',
				choices: [
					{ id: 'eq', label: '=' },
					{ id: 'ne', label: '!=' },
					{ id: 'gt', label: '>' },
					{ id: 'lt', label: '<' },
				],
			},
			{
				type: 'textinput',
				label: 'Value',
				id: 'value',
				default: '',
			},
		],
		subscribe: (fb) => {
			if (fb.options.variable) {
				self.feedback_variable_subscriptions[fb.id] = [fb.options.variable]
			}
		},
		unsubscribe: (fb) => {
			delete self.feedback_variable_subscriptions[fb.id]
		},
	}
	feedbacks['variable_variable'] = {
		type: 'boolean',
		label: 'Compare variable to variable',
		description: 'Change style based on a variable compared to another variable',
		style: {
			color: self.rgb(255, 255, 255),
			bgcolor: self.rgb(255, 0, 0),
		},
		options: [
			{
				type: 'dropdown',
				label: 'Compare Variable',
				tooltip: 'What variable to act on?',
				id: 'variable',
				default: 'internal:time_hms',
				choices: self.CHOICES_VARIABLES,
			},
			{
				type: 'dropdown',
				label: 'Operation',
				id: 'op',
				default: 'eq',
				choices: [
					{ id: 'eq', label: '=' },
					{ id: 'ne', label: '!=' },
					{ id: 'gt', label: '>' },
					{ id: 'lt', label: '<' },
				],
			},
			{
				type: 'dropdown',
				label: 'Against Variable',
				tooltip: 'What variable to compare with?',
				id: 'variable2',
				default: 'internal:time_hms',
				choices: self.CHOICES_VARIABLES,
			},
		],
		subscribe: (fb) => {
			if (fb.options.variable || fb.options.variable2) {
				self.feedback_variable_subscriptions[fb.id] = [fb.options.variable, fb.options.variable2]
			}
		},
		unsubscribe: (fb) => {
			delete self.feedback_variable_subscriptions[fb.id]
		},
	}

	self.setFeedbackDefinitions(feedbacks)
}

function compareValues(op, value, value2) {
	switch (op) {
		case 'gt':
			return value > parseFloat(value2)
		case 'lt':
			return value < parseFloat(value2)
		case 'ne':
			return value2 + '' != value + ''
		default:
			return value2 + '' == value + ''
	}
}

instance.prototype.feedback = function (feedback, bank, info) {
	let self = this

	if (feedback.type == 'variable_value') {
		let value = ''
		const id = feedback.options.variable.split(':')
		self.system.emit('variable_get', id[0], id[1], (v) => (value = v))

		return compareValues(feedback.options.op, value, feedback.options.value)
	} else if (feedback.type == 'variable_variable') {
		let value = ''
		let value2 = ''
		const id = feedback.options.variable.split(':')
		const id2 = feedback.options.variable2.split(':')
		self.system.emit('variable_get', id[0], id[1], (v) => (value = v))
		self.system.emit('variable_get', id2[0], id2[1], (v) => (value2 = v))

		return compareValues(feedback.options.op, value, value2)
	}
}

instance_skel.extendedBy(instance)
exports = module.exports = instance
