const InstanceSkel = require('../../../instance_skel')
let os = require('os')
var exec = require('child_process').exec

const actions = require('./actions')
const core = require('./core')
const feedback = require('./feedback')
const upgrade = require('./upgrade')
const variables = require('./variables')

class InstanceInternal extends InstanceSkel {
	constructor(registry, id, config) {
		super(registry.system, id, config)

		Object.assign(this, {
			...actions,
			...core,
			...feedback,
			...upgrade,
			...variables,
		})

		this.model = 0
		this.states = {}
		this.inputs = {}

		this.instance_errors = 0
		this.instance_warns = 0
		this.instance_oks = 0
		this.instance_status = {}

		this.system.on('instance_errorcount', function (errcount) {
			this.instance_status = errcount[3]
			this.instance_errors = errcount[2]
			this.instance_warns = errcount[1]
			this.instance_oks = errcount[0]

			this.setVariable('instance_errors', this.instance_errors)
			this.setVariable('instance_warns', this.instance_warns)
			this.setVariable('instance_oks', this.instance_oks)

			this.checkFeedbacks('instance_status')
		})

		this.timeInterval = setInterval(function () {
			const now = new Date()
			const hh = `0${now.getHours()}`.slice(-2)
			const mm = `0${now.getMinutes()}`.slice(-2)
			const ss = `0${now.getSeconds()}`.slice(-2)
			const month = `0${now.getMonth() + 1}`.slice(-2)
			const day = `0${now.getDate()}`.slice(-2)
			const hhmm = hh + ':' + mm
			const hhmmss = hhmm + ':' + ss
			this.setVariable('date_y', now.getFullYear())
			this.setVariable('date_m', month)
			this.setVariable('date_d', day)
			this.setVariable('time_hms', hhmmss)
			this.setVariable('time_hm', hhmm)
			this.setVariable('time_h', hh)
			this.setVariable('time_m', mm)
			this.setVariable('time_s', ss)
		}, 1000)

		this.addUpgradeScripts()
	}

	action(action, extras) {
		var id = action.action
		var cmd
		var opt = action.options
		var thePage = opt.page
		var theBank = opt.bank

		if (this.BUTTON_ACTIONS.includes(id)) {
			if (0 == opt.bank) {
				// 'this' button
				//			thePage = extras.page;
				theBank = extras.bank
			}
			if (0 == opt.page) {
				// 'this' page
				thePage = extras.page
			}
		}

		if (this.PAGE_ACTIONS.includes(id)) {
			if (0 == opt.page) {
				// 'this' page
				thePage = extras.page
			}
		}

		// get userconfig object
		this.userconfig = this.userconfig.get()

		if (id == 'set_page') {
			var surface = opt.controller == 'self' ? extras.deviceid : opt.controller
			this.changeControllerPage(surface, thePage, extras.page)
		} else if (id == 'set_page_byindex') {
			if (opt.controller < this.devices.length) {
				var surface = this.devices[opt.controller].serialnumber
				this.changeControllerPage(surface, thePage, extras.page)
			} else {
				this.log(
					'warn',
					'Trying to set controller #' +
						opt.controller +
						' but only ' +
						this.devices.length +
						' controller(s) are available.'
				)
			}
		} else if (id == 'inc_page') {
			var surface = opt.controller == 'self' ? extras.deviceid : opt.controller
			this.changeControllerPage(surface, Math.min(99, parseInt(extras.page) + 1), extras.page)
		} else if (id == 'dec_page') {
			var surface = opt.controller == 'self' ? extras.deviceid : opt.controller
			this.changeControllerPage(surface, Math.max(1, parseInt(extras.page) - 1), extras.page)
		} else if (id == 'lockout_device') {
			var surface = opt.controller == 'self' ? extras.deviceid : opt.controller
			if (this.userconfig.pin_enable) {
				// Change page after this runloop
				this.system.emit('bank_pressed', extras.page, extras.bank, false, surface)
				setImmediate(function () {
					if (this.userconfig.link_lockouts) {
						this.system.emit('lockoutall')
					} else {
						this.system.emit('lockout_device', surface, opt.page)
					}
				})
			}
		} else if (id == 'unlockout_device') {
			var surface = opt.controller == 'self' ? extras.deviceid : opt.controller
			if (this.userconfig.pin_enable) {
				// Change page after this runloop
				this.system.emit('bank_pressed', extras.page, extras.bank, false, surface)
				setImmediate(function () {
					if (this.userconfig.link_lockouts) {
						this.system.emit('unlockoutall')
					} else {
						this.system.emit('unlockout_device', surface, opt.page)
					}
				})
			}
		} else if (id == 'lockout_all') {
			if (this.userconfig.pin_enable) {
				this.system.emit('bank_pressed', extras.page, extras.bank, false, surface)
				setImmediate(function () {
					this.system.emit('lockoutall')
				})
			}
		} else if (id == 'unlockout_all') {
			if (this.userconfig.pin_enable) {
				this.system.emit('bank_pressed', extras.page, extras.bank, false, surface)
				setImmediate(function () {
					this.system.emit('unlockoutall')
				})
			}
		} else if (id == 'panic') {
			this.system.emit('action_delayed_abort')
		} else if (id == 'panic_bank') {
			this.system.emit('action_abort_bank', thePage, theBank, opt.unlatch)
		} else if (id == 'rescan') {
			this.system.emit('devices_reenumerate')
		} else if (id == 'bgcolor') {
			this.system.emit('bank_changefield', thePage, theBank, 'bgcolor', opt.color)
		} else if (id == 'textcolor') {
			this.system.emit('bank_changefield', thePage, theBank, 'color', opt.color)
		} else if (id == 'button_text') {
			this.system.emit('bank_changefield', thePage, theBank, 'text', opt.label)
		} else if (id == 'button_pressrelease') {
			var surface = opt.controller == 'self' ? extras.deviceid : opt.controller
			this.system.emit('bank_pressed', thePage, theBank, true, surface)
			this.system.emit('bank_pressed', thePage, theBank, false, surface)
		} else if (id == 'button_press') {
			var surface = opt.controller == 'self' ? extras.deviceid : opt.controller
			this.system.emit('bank_pressed', thePage, theBank, true, surface)
		} else if (id == 'button_release') {
			var surface = opt.controller == 'self' ? extras.deviceid : opt.controller
			this.system.emit('bank_pressed', thePage, theBank, false, surface)
		} else if (id == 'exec') {
			if (opt.path !== undefined) {
				this.debug("Running path: '" + opt.path + "'")
				exec(
					opt.path,
					{
						timeout: opt.timeout === undefined ? 5000 : opt.timeout,
					},
					function (error, stdout, stderr) {
						if (error) {
							this.log('error', 'Shell command failed. Guru meditation: ' + JSON.stringify(error))
							this.debug(error)
						}
					}
				)
			}
		} else if (id == 'app_exit') {
			this.registry.exit()
		} else if (id == 'app_restart') {
			this.registry.restart()
		}
	}

	addSystemCallback(name, cb) {
		if (this.callbacks[name] === undefined) {
			this.callbacks[name] = cb.bind(this)
			this.system.on(name, cb)
		}
	}

	changeControllerPage(surface, page, from) {
		// no history yet
		// start with the current (from) page
		if (!this.pageHistory[surface]) {
			this.pageHistory[surface] = {
				history: [from],
				index: 0,
			}
		}

		// determine the 'to' page
		if (page === 'back' || page === 'forward') {
			const pageDirection = page === 'back' ? -1 : 1
			const pageIndex = this.pageHistory[surface].index + pageDirection
			const pageTarget = this.pageHistory[surface].history[pageIndex]

			// change only if pageIndex points to a real page
			if (pageTarget !== undefined) {
				setImmediate(function () {
					this.system.emit('device_page_set', surface, pageTarget)
				})

				this.pageHistory[surface].index = pageIndex
			}
		} else {
			// Change page after this runloop
			setImmediate(function () {
				this.system.emit('device_page_set', surface, page)
			})

			// Clear forward page history beyond current index, add new history entry, increment index;
			this.pageHistory[surface].history = this.pageHistory[surface].history.slice(
				0,
				this.pageHistory[surface].index + 1
			)
			this.pageHistory[surface].history.push(page)
			this.pageHistory[surface].index += 1

			// Limit the max history
			const maxPageHistory = 100
			if (this.pageHistory[surface].history.length > maxPageHistory) {
				const startIndex = this.pageHistory[surface].history.length - maxPageHistory
				const endIndex = this.pageHistory[surface].history.length
				this.pageHistory[surface].history = this.pageHistory[surface].history.slice(startIndex, endIndex)
			}
		}

		return
	}

	// Return config fields for web config
	config_fields() {
		return [
			{
				type: 'text',
				id: 'info',
				width: 12,
				label: 'Information',
				value: 'This module exposes internal functions of companion and does not have any configuration options',
			},
		]
	}

	// When module gets deleted
	destroy() {
		if (this.timeInterval) {
			clearInterval(this.timeInterval)
		}
		this.removeAllSystemCallbacks()
	}

	getAllDevices() {
		this.system.emit('devices_list_get', function (list) {
			this.devices = list
		})
	}

	getAllInstances(instances, active) {
		this.instances = instances
		this.active = active
		this.CHOICES_INSTANCES.length = 0

		for (var key in this.instances) {
			if (this.instances[key].label !== 'internal') {
				this.CHOICES_INSTANCES.push({ label: this.instances[key].label, id: key })
			}
		}

		this.init_actions()

		this.init_feedback()
	}

	getAllPages() {
		this.system.emit('get_page', function (pages) {
			this.pages = pages
		})
	}

	getBoundIp() {
		this.system.emit('config_get', 'bind_ip', function (bind_ip) {
			this.setVariable('bind_ip', bind_ip)
		})
	}

	getNetworkInterfaces() {
		var interfaces = []
		const networkInterfaces = os.networkInterfaces()

		for (const iFace in networkInterfaces) {
			let numberOfAddresses = networkInterfaces[iFace].length
			for (let i = 0; i < numberOfAddresses; i++) {
				if (networkInterfaces[iFace][i]['family'] === 'IPv4') {
					interfaces.push({
						label: iFace,
						name: iFace,
						address: networkInterfaces[iFace][i]['address'],
					})
				}
			}
		}

		return interfaces
	}

	init() {
		this.callbacks = {}
		this.instances = {}
		this.active = {}
		this.pages = {}
		this.pageHistory = {}

		this.CHOICES_INSTANCES = []
		this.CHOICES_SURFACES = []
		this.CHOICES_PAGES = []
		this.CHOICES_BANKS = [{ label: 'This button', id: 0 }]

		for (var bank = 1; bank <= global.MAX_BUTTONS; bank++) {
			this.CHOICES_BANKS.push({ label: bank, id: bank })
		}

		this.BUTTON_ACTIONS = [
			'button_pressrelease',
			'button_press',
			'button_release',
			'button_text',
			'textcolor',
			'bgcolor',
			'panic_bank',
		]

		this.PAGE_ACTIONS = ['set_page', 'set_page_byindex', 'inc_page', 'dec_page']

		this.getAllPages()
		this.addSystemCallback('page_update', this.updatePages.bind(this))

		this.getAllDevices()
		this.addSystemCallback('devices_list', this.updateDevices.bind(this))

		this.instanceSaved()
		this.addSystemCallback('instance_save', this.instanceSaved.bind(this))

		this.status(this.STATE_OK)

		this.init_feedback()
		this.checkFeedbacks()
		this.update_variables()

		this.getBoundIp()
		this.addSystemCallback('ip_rebind', this.getBoundIp.bind(this))
	}

	instanceSaved() {
		this.system.emit('instance_getall', this.getAllInstances.bind(this))
	}

	removeAllSystemCallbacks() {
		for (var key in this.callbacks) {
			this.system.removeListener(key, this.callbacks[key])
			delete this.callbacks[key]
		}
	}

	updateConfig(config) {
		this.config = config
	}

	updateDevices(list) {
		this.devices = list
		this.init_actions()
	}

	updatePages() {
		// Update dropdowns
		this.init_actions()
	}
}

exports = module.exports = InstanceInternal
