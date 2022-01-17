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

const os = require('os')
const shortid = require('shortid')
const { cloneDeep } = require('lodash')
const { sendResult } = require('./resources/util')

class loadsave {
	debug = require('debug')('lib/loadsave')

	constructor(system) {
		this.system = system

		this.system.emit('db_get', 'bank', (res) => {
			this.config = res
		})

		this.system.emit('db_get', 'instance', (res) => {
			this.instance = res
		})

		this.system.emit('action_get_banks', (bank_actions) => {
			this.bank_actions = bank_actions
		})

		this.system.emit('release_action_get_banks', (bank_release_actions) => {
			this.bank_release_actions = bank_release_actions
		})

		this.system.emit('feedback_getall', (feedbacks) => {
			this.feedbacks = feedbacks
		})

		this.system.on('export_bank', (page, bank, cb) => {
			let exp = {}

			exp.config = cloneDeep(this.config[page][bank])
			exp.instances = {}

			if (this.bank_actions[page] !== undefined) {
				exp.actions = cloneDeep(this.bank_actions[page][bank])
			}

			if (this.bank_release_actions[page] !== undefined) {
				exp.release_actions = cloneDeep(this.bank_release_actions[page][bank])
			}

			if (this.feedbacks[page] !== undefined) {
				exp.feedbacks = cloneDeep(this.feedbacks[page][bank])
			}

			this.debug('Exported config to bank ' + page + '.' + bank)
			cb(exp)
		})

		this.system.emit('io_get', (io) => {
			this.io = io
			this.system.on('io_connect', (socket) => {
				socket.on('loadsave_import_config', (data, answer) => {
					let object
					try {
						object = JSON.parse(data)
					} catch (e) {
						sendResult(answer, 'loadsave_import_config:result', 'File is corrupted or unknown format')
						return
					}

					if (object.version > file_version) {
						sendResult(
							answer,
							'loadsave_import_config:result',
							'File was saved with a newer unsupported version of Companion'
						)
						return
					}

					if (object.type == 'bank') {
						sendResult(answer, 'loadsave_import_config:result', 'Cannot load single banks')
						return
					}

					object = this.versionCheck(object)

					// rest is done from browser
					sendResult(answer, 'loadsave_import_config:result', null, object)
				})

				socket.on('loadsave_reset_page_all', (page) => {
					for (let i = 1; i <= global.MAX_BUTTONS; ++i) {
						console.log('RESET BANK', page, i)
						this.system.emit('bank_reset', page, i)
					}

					// make magical page buttons!
					this.system.emit('bank_style', page, 1, 'pageup')
					this.system.emit('bank_style', page, 9, 'pagenum')
					this.system.emit('bank_style', page, 17, 'pagedown')
					this.system.emit('page_set', page, { name: 'PAGE' })

					socket.emit('loadsave_reset_page:reset', null, 'ok')
				})

				socket.on('loadsave_reset_page_nav', (page) => {
					// reset nav banks
					this.system.emit('bank_reset', page, 1)
					this.system.emit('bank_reset', page, 9)
					this.system.emit('bank_reset', page, 17)

					// make magical page buttons!
					this.system.emit('bank_style', page, 1, 'pageup')
					this.system.emit('bank_style', page, 9, 'pagenum')
					this.system.emit('bank_style', page, 17, 'pagedown')

					this.system.emit('page_set', page, { name: 'PAGE' })

					socket.emit('loadsave_reset_page:reset', null, 'ok')
				})

				socket.on('reset_all', (answer) => {
					for (let page = 1; page <= 99; ++page) {
						this.system.emit('page_set', page, { name: 'PAGE' })

						for (let bank = 1; bank <= global.MAX_BUTTONS; ++bank) {
							this.system.emit('bank_reset', page, bank)
						}

						// make magical page buttons!
						this.system.emit('bank_style', page, 1, 'pageup')
						this.system.emit('bank_style', page, 9, 'pagenum')
						this.system.emit('bank_style', page, 17, 'pagedown')
					}

					for (const key in this.instance) {
						if (key != 'bitfocus-companion' && this.instance[key].instance_type != 'bitfocus-companion') {
							this.system.emit('instance_delete', key, this.instance[key].label)
						}
					}

					// reset the scheduler/triggers
					this.system.emit('schedule_clear')
					this.system.emit('custom_variables_clear')

					sendResult(answer, 'reset_all:result', null, 'ok')
				})

				socket.on('loadsave_import_full', (data, answer) => {
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

					for (const key in this.instance) {
						if (key != 'bitfocus-companion' && this.instance[key].instance_type != 'bitfocus-companion') {
							this.system.emit('instance_delete', key, this.instance[key].label)
						}
					}

					for (const key in data.instances) {
						if (key == 'bitfocus-companion' || data.instances[key].instance_type == 'bitfocus-companion') {
							delete data.instances[key]
							continue
						}

						this.instance[key] = data.instances[key]
						if (data.instances[key].enabled) {
							this.system.emit('instance_activate', key)
						}
					}

					this.system.emit('custom_variables_replace_all', data.custom_variables || {})

					for (let page = 1; page <= 99; ++page) {
						if (data.page !== undefined && data.page[page] !== undefined) {
							this.system.emit('page_set_noredraw', page, data.page[page])
						} else {
							this.system.emit('page_set_noredraw', page, { name: 'PAGE' })
						}

						for (let bank = 1; bank <= global.MAX_BUTTONS; ++bank) {
							let obj = {}

							obj.config = data.config[page][bank]

							if (
								data.actions !== undefined &&
								data.actions[page] !== undefined &&
								data.actions[page][bank] !== undefined
							) {
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

					sendResult(answer, 'loadsave_import_full:result', null, 'ok')
				})

				socket.on('loadsave_import_page', (topage, frompage, data) => {
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

					if (!data.instances['bitfocus-companion']) {
						const idx = data.orig_version > 1 ? 2 : -1 // This is a hack. After this version it is tracked correctly.
						// We put it to 2 as its the 'safest' value to not break recent exports, at the cost of older ones (rather than the other way around)
						// But if data.orig_version is 1, then we know the snapshot needs to run all the scripts

						data.instances['bitfocus-companion'] = {
							import_to: 'bitfocus-companion',
							label: 'internal',
							id: 'bitfocus-companion',
							instance_type: 'bitfocus-companion',
							_configIdx: idx,
						}
					} else {
						data.instances['bitfocus-companion'].import_to = 'bitfocus-companion'
					}

					for (const key in data.instances) {
						let type = data.instances[key].instance_type
						this.system.emit('module_redirect', type, (redirect_name) => {
							// follow legacy redirect
							type = redirect_name || type
						})

						let instance_created = false
						let instance_id = key == 'bitfocus-companion' ? 'bitfocus-companion' : data.instances[key].import_to
						if (key != 'bitfocus-companion' && instance_id == 'new') {
							let product = data.instances[key].product
							this.system.emit(
								'instance_add',
								{ type, product },
								(id, config) => {
									instance_id = id
									instance_created = true

									for (const i in data.instances[key]) {
										if (i != 'label') {
											config[i] = data.instances[key][i]
										}
									}

									this.system.emit('instance_config_put', id, config)
								},
								true
							)
						}

						// Ensure the target instance exists
						if (this.instance[instance_id]) {
							for (const bank in data.config) {
								data.config[bank].text = this.variableRename(
									data.config[bank].text,
									data.instances[key].label,
									this.instance[instance_id].label
								)
							}
						}

						let instance_actions = []

						for (const bank in data.actions) {
							if (!this.instance[instance_id]) {
								// filter out actions from the missing instance
								data.actions[bank] = data.actions[bank].filter((a) => a.instance != key)
							} else {
								for (let i = 0; i < data.actions[bank].length; ++i) {
									let act = data.actions[bank][i]

									if (act.instance == key) {
										act.instance = instance_id
										act.label = act.instance + ':' + act.action
										instance_actions.push(act)
									}
								}
							}
						}

						for (const bank in data.release_actions) {
							if (!this.instance[instance_id]) {
								// filter out actions from the missing instance
								data.release_actions[bank] = data.release_actions[bank].filter((a) => a.instance != key)
							} else {
								for (let i = 0; i < data.release_actions[bank].length; ++i) {
									let act = data.release_actions[bank][i]

									if (act.instance == key) {
										act.instance = instance_id
										act.label = act.instance + ':' + act.action
										instance_actions.push(act)
									}
								}
							}
						}

						let instance_feedbacks = []
						for (const bank in data.feedbacks) {
							if (!this.instance[instance_id]) {
								// filter out feedbacks from the missing instance
								data.feedbacks[bank] = data.feedbacks[bank].filter((a) => a.instance_id != key)
							} else {
								for (let i = 0; i < data.feedbacks[bank].length; ++i) {
									let act = data.feedbacks[bank][i]

									if (act.instance_id == key) {
										act.instance_id = instance_id
										instance_feedbacks.push(act)
									}
								}
							}
						}

						if (this.instance[instance_id]) {
							// run upgrade-scripts for all the imported things
							this.system.emit(
								'instance_upgrade_imported',
								instance_id,
								instance_created,
								type,
								data.instances[key],
								instance_actions,
								instance_feedbacks
							)

							if (instance_created) {
								// now the module can be enabled
								this.system.emit('instance_enable', instance_id, true)
							}
						}
					}

					for (const bank in data.config) {
						let obj = {}
						obj.config = data.config !== undefined ? data.config[bank] : {}
						obj.actions = data.actions !== undefined ? data.actions[bank] : []
						obj.release_actions = data.release_actions !== undefined ? data.release_actions[bank] : []
						obj.feedbacks = data.feedbacks !== undefined ? data.feedbacks[bank] : []

						this.system.emit('import_bank', topage, bank, obj)
					}
				})
			})
		})

		this.system.on('import_bank', (page, bank, imp, cb) => {
			this.system.emit('bank_reset', page, bank)

			if (imp.config === undefined) {
				// this should technically throw an exception
				imp.config = {}
			}

			if (imp.config.style !== undefined && imp.config.style == 'text') {
				// v2.0.0: 'text' button style is now 'png'
				imp.config.style = 'png'
			}

			// TODO: Rename variable definitions
			this.config[page][bank] = imp.config

			if (imp.actions !== undefined) {
				if (this.bank_actions[page] === undefined) {
					this.bank_actions[page] = {}
				}
				if (this.bank_actions[page][bank] === undefined) {
					this.bank_actions[page][bank] = []
				}
				let actions = this.bank_actions[page][bank]

				for (let i = 0; i < imp.actions.length; ++i) {
					let obj = imp.actions[i]
					obj.id = shortid.generate()
					actions.push(obj)
				}
			}

			if (imp.release_actions !== undefined) {
				if (this.bank_release_actions[page] === undefined) {
					this.bank_release_actions[page] = {}
				}
				if (this.bank_release_actions[page][bank] === undefined) {
					this.bank_release_actions[page][bank] = []
				}
				let release_actions = this.bank_release_actions[page][bank]

				for (let i = 0; i < imp.release_actions.length; ++i) {
					let obj = imp.release_actions[i]
					obj.id = shortid.generate()
					release_actions.push(obj)
				}
			}

			if (imp.feedbacks !== undefined) {
				if (this.feedbacks[page] === undefined) {
					this.feedbacks[page] = {}
				}
				if (this.feedbacks[page][bank] === undefined) {
					this.feedbacks[page][bank] = []
				}
				let feedbacks = this.feedbacks[page][bank]

				for (let i = 0; i < imp.feedbacks.length; ++i) {
					let obj = imp.feedbacks[i]
					obj.id = shortid.generate()
					feedbacks.push(obj)
				}
			}

			this.system.emit('graphics_bank_invalidate', page, bank)
			this.system.emit('bank_update', this.config)
			this.system.emit('feedback_check_bank', page, bank)
			this.system.emit('feedback_subscribe_bank', page, bank)
			this.system.emit('action_subscribe_bank', page, bank)

			this.system.emit('action_save')
			this.system.emit('feedback_save')
			this.system.emit('db_save')

			this.debug('Imported config to bank ' + page + '.' + bank)
			if (typeof cb == 'function') {
				cb()
			}
		})

		this.system.on('http_req', (req, res, done) => {
			let match

			if ((match = req.url.match(/^\/bank_export\/((\d+)\/(\d+))?/))) {
				let page = match[2]
				let bank = match[3]

				if (page === null || bank === null) {
					// 404 handler will take over
					return
				}

				let exp
				this.system.emit('export_bank', page, bank, (data) => {
					exp = data
				})

				// Export file protocol version
				exp.version = file_version
				exp.type = 'bank'

				exp.instances = {}

				let instance_ids = new Set()

				for (const action of exp.actions) {
					instance_ids.add(action.instance)
				}
				for (const action of exp.release_actions) {
					instance_ids.add(action.instance)
				}
				for (const feedback of exp.feedbacks) {
					instance_ids.add(feedback.instance_id)
				}

				for (const instance_id of instance_ids) {
					if (instance_id && this.instance[instance_id]) {
						exp.instances[instance_id] = this.instance[instance_id]
					}
				}

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

				exp.config = this.cleanPage(cloneDeep(this.config[page]))
				exp.instances = {}

				exp.actions = this.bank_actions[page]
				exp.release_actions = this.bank_release_actions[page]
				exp.feedbacks = this.feedbacks[page]

				this.system.emit('get_page', (page_config) => {
					exp.page = page_config[page]
				})

				let instance_ids = new Set()

				for (const bank of Object.values(exp.actions)) {
					if (bank) {
						for (const action of bank) {
							instance_ids.add(action.instance)
						}
					}
				}
				for (const bank of Object.values(exp.release_actions)) {
					if (bank) {
						for (const action of bank) {
							instance_ids.add(action.instance)
						}
					}
				}
				for (const bank of Object.values(exp.feedbacks)) {
					if (bank) {
						for (const feedback of bank) {
							instance_ids.add(feedback.instance_id)
						}
					}
				}

				for (const instance_id of instance_ids) {
					if (instance_id && this.instance[instance_id]) {
						exp.instances[instance_id] = this.instance[instance_id]
					}
				}

				res.writeHeader(200, {
					'Content-Type': 'application/json',
					'Content-Disposition':
						'attachment; filename="' +
						os.hostname() +
						'_page ' +
						page +
						'_' +
						this.getTimestamp() +
						'.companionconfig"',
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

				exp.config = this.cleanPages(cloneDeep(this.config))
				exp.instances = {}

				exp.actions = this.bank_actions
				exp.release_actions = this.bank_release_actions

				this.system.emit('get_page', (page_config) => {
					exp.page = page_config
				})

				this.system.emit('db_get', 'instance', (res) => {
					exp.instances = res
				})

				this.system.emit('custom_variables_get', (res) => {
					exp.custom_variables = res
				})

				exp.feedbacks = this.feedbacks

				res.writeHeader(200, {
					'Content-Type': 'application/json',
					'Content-Disposition':
						'attachment; filename="' + os.hostname() + '_full-config' + '_' + this.getTimestamp() + '.companionconfig"',
				})
				res.end(JSON.stringify(exp))

				done()
			}
		})
	}

	variableRename(str, fromname, toname) {
		let result

		if (str) {
			this.system.emit('variable_rename_callback', str, fromname, toname, (res) => {
				result = res
			})
		}

		return result
	}

	convert15to32(obj) {
		let newobj = {}
		for (let i = 0; i < global.MAX_BUTTONS; ++i) {
			newobj[i + 1] = []
		}

		for (const bank in obj) {
			this.system.emit('bank_get12to32', parseInt(bank), (_bank) => {
				newobj[_bank] = obj[bank]
			})
		}

		return newobj
	}

	// Convert config from older versions of companion
	// Commence backwards compatibility!
	versionCheck(obj) {
		// Version 1 = 15 keys, Version 2 = 32 keys
		if (obj.version === 1) {
			if (obj.type == 'full') {
				console.log('FULL CONFIG; do conversion for each page')
				for (const page in obj.page) {
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

			data.orig_version = obj.version

			data.type = obj.type
			data.page = obj.page

			data.instances = obj.instances

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

	convert2Digit(num) {
		if (num < 10) {
			num = '0' + num
		}
		return num
	}

	getTimestamp() {
		let d = new Date()
		let year = d.getFullYear().toString()
		let month = this.convert2Digit(d.getMonth() + 1)
		let day = this.convert2Digit(d.getDate())
		let hrs = this.convert2Digit(d.getHours())
		let mins = this.convert2Digit(d.getMinutes())
		let out = year + month + day + '-' + hrs + mins
		return out
	}
}

exports = module.exports = function (system) {
	return new loadsave(system)
}