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

const file_version = 2

const debug = require('debug')('Data/ImportExport')
const CoreBase = require('../Core/Base')
const shortid = require('shortid')
const os = require('os')
const _ = require('lodash')

class ImportExport extends CoreBase {
	constructor(registry) {
		super(registry, 'loadsave')

		this.config = this.db.getKey('bank')
		this.instance = this.db.getKey('instance')

		this.system.on('io_connect', (client) => {
			client.on('loadsave_import_config', (data, answer) => {
				let object

				try {
					object = JSON.parse(data)
				} catch (e) {
					answer('File is corrupted or unknown format')
					return
				}

				if (object.version > file_version) {
					answer('File was saved with a newer unsupported version of Companion')
					return
				}

				if (object.type == 'bank') {
					answer('Cannot load single banks')
					return
				}

				object = this.versionCheck(object)

				// rest is done from browser
				answer(null, object)
			})

			client.on('loadsave_reset_page_all', (page) => {
				this.resetPageAll(page)
			})

			client.on('loadsave_reset_page_nav', (page) => {
				this.resetPageNav(page)
			})

			client.on('reset_all', (answer) => {
				this.resetAll()
				answer(null, 'ok')
			})

			client.on('loadsave_import_full', (data, answer) => {
				this.importAll(data)
				answer(null, 'ok')
			})

			client.on('loadsave_import_page', (topage, frompage, data) => {
				this.importPage(topage, frompage, data)
			})
		})

		this.system.on('http_req', this.processHttpRequest.bind(this))
	}

	cleanPages(pages) {
		for (let i = 1; i <= 99; ++i) {
			if (pages[i] === undefined) {
				pages[i] = {}
			}

			this.cleanPage(pages[i])
		}
		return pages
	}

	cleanPage(page) {
		for (let i = 1; i <= global.MAX_BUTTONS; ++i) {
			if (page[i] === undefined) {
				page[i] = {}
			}
		}
		return page
	}

	convert15to32(obj) {
		let newobj = {}

		for (let i = 0; i < global.MAX_BUTTONS; ++i) {
			newobj[i + 1] = []
		}

		for (let bank in obj) {
			this.system.emit('bank_get15to32', parseInt(bank), (_bank) => {
				newobj[_bank] = obj[bank]
			})
		}

		return newobj
	}

	convert2Digit(num) {
		if (num < 10) {
			num = '0' + num
		}
		return num
	}

	getTimestamp() {
		const d = new Date()
		const year = d.getFullYear().toString()
		const month = this.convert2Digit(d.getMonth() + 1)
		const day = this.convert2Digit(d.getDate())
		const hrs = this.convert2Digit(d.getHours())
		const mins = this.convert2Digit(d.getMinutes())
		let out = year + month + day + '-' + hrs + mins
		return out
	}

	importAll(data) {
		// Support for reading erroneous exports from pre-release
		if (data.bank_release_actions !== undefined) {
			data.release_actions = data.bank_release_actions
			delete data.bank_release_actions
		}

		for (let page = 1; page <= 99; ++page) {
			for (let bank = 1; bank <= global.MAX_BUTTONS; ++bank) {
				this.system.emit('bank_reset', page, bank)
			}
		}

		for (let key in this.instance) {
			if (key != 'bitfocus-companion' && this.instance[key].instance_type != 'bitfocus-companion') {
				this.system.emit('instance_delete', key, this.instance[key].label)
			}
		}

		for (let key in data.instances) {
			if (key == 'bitfocus-companion' || data.instances[key].instance_type == 'bitfocus-companion') {
				delete data.instances[key]
				continue
			}

			this.instance[key] = data.instances[key]

			if (data.instances[key].enabled) {
				this.system.emit('instance_activate', key)
			}
		}

		for (let page = 1; page <= 99; ++page) {
			if (data.page !== undefined && data.page[page] !== undefined) {
				this.system.emit('page_set_noredraw', page, data.page[page])
			} else {
				this.system.emit('page_set_noredraw', page, { name: 'PAGE' })
			}

			for (let bank = 1; bank <= global.MAX_BUTTONS; ++bank) {
				let obj = {}

				obj.config = data.config[page][bank]

				if (data.actions !== undefined && data.actions[page] !== undefined && data.actions[page][bank] !== undefined) {
					obj.actions = data.actions[page][bank]
				} else {
					obj.actions = []
				}

				if (
					data.release_actions !== undefined &&
					data.release_actions[page] !== undefined &&
					data.release_actions[page][bank] !== undefined
				) {
					obj.release_actions = data.release_actions[page][bank]
				} else {
					obj.release_actions = []
				}

				if (
					data.feedbacks !== undefined &&
					data.feedbacks[page] !== undefined &&
					data.feedbacks[page][bank] !== undefined
				) {
					obj.feedbacks = data.feedbacks[page][bank]
				} else {
					obj.feedbacks = []
				}

				this.system.emit('import_bank', page, bank, obj)
			}
		}
	}

	importPage(topage, frompage, data) {
		// Support for reading erroneous exports from pre-release
		if (data.bank_release_actions !== undefined) {
			data.release_actions = data.bank_release_actions
			delete data.bank_release_actions
		}

		if (data.type == 'full') {
			data.page = data.page[frompage]
			data.config = data.config[frompage]
			data.actions = data.actions === undefined ? {} : data.actions[frompage]
			data.release_actions = data.release_actions === undefined ? {} : data.release_actions[frompage]
			data.feedbacks = data.feedbacks === undefined ? {} : data.feedbacks[frompage]
		}

		if (data.page !== undefined) {
			this.system.emit('page_set', topage, data.page)
		} else {
			this.system.emit('page_set', topage, { name: 'PAGE' })
		}

		for (let i = 1; i <= global.MAX_BUTTONS; ++i) {
			this.system.emit('bank_reset', topage, i)
		}

		for (let key in data.instances) {
			if (key != 'bitfocus-companion' && data.instances[key].import_to == 'new') {
				const type = data.instances[key].instance_type
				const product = data.instances[key].product
				this.system.emit('instance_add', { type, product }, (id, config) => {
					data.instances[key].import_to = id

					for (let i in data.instances[key]) {
						if (i != 'label') {
							config[i] = data.instances[key][i]
						}
					}

					this.system.emit('instance_config_put', id, config)
				})
			}

			for (let bank in data.config) {
				data.config[bank].text = this.variableRename(
					data.config[bank].text,
					data.instances[key].label,
					this.instance[data.instances[key].import_to].label
				)
			}

			for (let bank in data.actions) {
				for (let i = 0; i < data.actions[bank].length; ++i) {
					let act = data.actions[bank][i]

					if (act.instance == key) {
						act.instance = data.instances[key].import_to
						act.label = act.instance + ':' + act.action
					}
				}
			}

			for (let bank in data.release_actions) {
				for (let i = 0; i < data.release_actions[bank].length; ++i) {
					let act = data.release_actions[bank][i]

					if (act.instance == key) {
						act.instance = data.instances[key].import_to
						act.label = act.instance + ':' + act.action
					}
				}
			}

			for (let bank in data.feedbacks) {
				for (let i = 0; i < data.feedbacks[bank].length; ++i) {
					let act = data.feedbacks[bank][i]

					if (act.instance_id == key) {
						act.instance_id = data.instances[key].import_to
					}
				}
			}
		}

		for (let bank in data.config) {
			let obj = {}
			obj.config = data.config !== undefined ? data.config[bank] : {}
			obj.actions = data.actions !== undefined ? data.actions[bank] : []
			obj.release_actions = data.release_actions !== undefined ? data.release_actions[bank] : []
			obj.feedbacks = data.feedbacks !== undefined ? data.feedbacks[bank] : []

			this.system.emit('import_bank', topage, bank, obj)
		}
	}

	processHttpRequest(req, res, done) {
		let match

		if ((match = req.url.match(/^\/bank_export\/((\d+)\/(\d+))?/))) {
			let page = match[2]
			let bank = match[3]

			if (page === null || bank === null) {
				// 404 handler will take over
				return
			}

			let exp = this.bank.exportBank(page, bank)

			res.writeHeader(200, {
				'Content-Type': 'application/json',
				'Content-Disposition':
					'attachment; filename="' +
					os.hostname() +
					'_bank ' +
					page +
					'-' +
					bank +
					'_' +
					this.getTimestamp() +
					'.companionconfig"',
			})
			res.end(JSON.stringify(exp))

			done()
		}

		if ((match = req.url.match(/^\/page_export\/((\d+))?/))) {
			let page = match[2]

			if (page === null || bank === null) {
				// 404 handler will take over
				return
			}

			// Export file protocol version
			let exp = {
				version: file_version,
				type: 'page',
			}

			exp.config = this.cleanPage(_.cloneDeep(this.config[page]))
			exp.instances = {}

			exp.actions = this.bank_actions[page]
			exp.release_actions = this.bank_release_actions[page]

			this.system.emit('get_page', (page_config) => {
				exp.page = page_config[page]
			})

			exp.feedbacks = this.feedbacks[page]

			for (let apage in exp.actions) {
				for (let key in exp.actions[apage]) {
					let action = exp.actions[apage][key]

					if (exp.instances[action.instance] === undefined) {
						if (this.instance[action.instance] !== undefined) {
							exp.instances[action.instance] = this.instance[action.instance]
						}
					}
				}
			}

			res.writeHeader(200, {
				'Content-Type': 'application/json',
				'Content-Disposition':
					'attachment; filename="' + os.hostname() + '_page ' + page + '_' + this.getTimestamp() + '.companionconfig"',
			})
			res.end(JSON.stringify(exp))

			done()
		}

		if ((match = req.url.match(/^\/full_export/))) {
			// Export file protocol version
			let exp = {
				version: file_version,
				type: 'full',
			}

			exp.config = this.cleanPages(_.cloneDeep(this.config))
			exp.instances = {}

			exp.actions = this.bank_actions
			exp.release_actions = this.bank_release_actions

			this.system.emit('get_page', (page_config) => {
				exp.page = page_config
			})

			exp.instances = this.db.getKey('instance')

			exp.feedbacks = this.feedbacks

			res.writeHeader(200, {
				'Content-Type': 'application/json',
				'Content-Disposition':
					'attachment; filename="' + os.hostname() + '_full-config' + '_' + this.getTimestamp() + '.companionconfig"',
			})
			res.end(JSON.stringify(exp))

			done()
		}
	}

	resetAll() {
		for (let page = 1; page <= 99; ++page) {
			this.system.emit('page_set', page, { name: 'PAGE' })

			for (let bank = 1; bank <= global.MAX_BUTTONS; ++bank) {
				this.system.emit('bank_reset', page, bank)
			}
		}

		for (let key in this.instance) {
			if (key != 'bitfocus-companion' && this.instance[key].instance_type != 'bitfocus-companion') {
				this.system.emit('instance_delete', key, this.instance[key].label)
			}
		}
	}

	resetPageAll(page) {
		for (let i = 1; i <= global.MAX_BUTTONS; ++i) {
			console.log('RESET BANK', page, i)
			this.system.emit('bank_reset', page, i)
		}

		// make magical page buttons!
		this.system.emit('bank_style', page, 1, 'pageup')
		this.system.emit('bank_style', page, 9, 'pagenum')
		this.system.emit('bank_style', page, 17, 'pagedown')
		this.system.emit('page_set', page, { name: 'PAGE' })
	}

	resetPageNav(page) {
		// reset nav banks
		this.system.emit('bank_reset', page, 1)
		this.system.emit('bank_reset', page, 9)
		this.system.emit('bank_reset', page, 17)

		// make magical page buttons!
		this.system.emit('bank_style', page, 1, 'pageup')
		this.system.emit('bank_style', page, 9, 'pagenum')
		this.system.emit('bank_style', page, 17, 'pagedown')

		this.system.emit('page_set', page, { name: 'PAGE' })
	}

	variableRename(str, fromname, toname) {
		let result

		this.system.emit('variable_rename_callback', str, fromname, toname, (res) => {
			result = res
		})

		return result
	}

	// Convert config from older versions of companion
	// Commence backwards compatibility!
	versionCheck(obj) {
		// Version 1 = 15 keys, Version 2 = 32 keys
		if (obj.version === 1) {
			if (obj.type == 'full') {
				console.log('FULL CONFIG; do conversion for each page')
				for (let page in obj.page) {
					let data = { type: 'page', version: 1 }

					if (obj.actions === undefined) {
						obj.actions = {}
					}

					if (obj.release_actions === undefined) {
						obj.release_actions = {}
					}

					if (obj.feedbacks === undefined) {
						obj.feedbacks = {}
					}

					data.page = obj.page[page]
					data.config = obj.config[page]
					data.actions = obj.actions[page]
					data.release_actions = obj.release_actions[page]
					data.feedbacks = obj.feedbacks[page]

					console.log('Recursive convert page ' + page, data)
					let newdata = this.versionCheck(data)
					console.log('Converted to ', newdata)

					obj.page[page] = newdata.page
					obj.config[page] = newdata.config
					obj.actions[page] = newdata.actions
					obj.release_actions[page] = newdata.release_actions
					obj.feedbacks[page] = newdata.feedbacks
				}

				return obj
			}

			console.log('Single page convert', obj)
			let data = {}

			data.page = obj.page

			// Banks
			data.config = this.convert15to32(obj.config)
			data.config[1] = { style: 'pageup' }
			data.config[9] = { style: 'pagenum' }
			data.config[17] = { style: 'pagedown' }

			// Actions
			data.actions = this.convert15to32(obj.actions)

			// Release actions
			data.release_actions = this.convert15to32(obj.release_actions)

			// Feedbacks
			data.feedbacks = this.convert15to32(obj.feedbacks)

			console.log('Converted')
			return data
		}

		// Version 2 == no changes needed
		return obj
	}
}

exports = module.exports = ImportExport
