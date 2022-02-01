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
const DataUpgrade = require('../Data/Upgrade')
const { cloneDeep } = require('lodash')
const { sendResult } = require('../Resources/Util')
const { constants } = require('buffer')
const CoreBase = require('../Core/Base')
const Registry = require('../Registry')

class DataImportExport extends CoreBase {
	constructor(registry) {
		super(registry, 'import/export', 'lib/Data/ImportExport')

		this.system.on('modules_loaded', (cb) => {
			this.config = this.db.getKey('bank')

			this.instanceData = this.db.getKey('instance')

			this.system.emit('action_get_bank_sets', (bank_action_sets) => {
				this.bank_action_sets = bank_action_sets
			})

			this.system.emit('feedback_getall', (feedbacks) => {
				this.feedbacks = feedbacks
			})
		})

		this.system.on('export_bank', (page, bank, cb) => {
			let exp = {}

			exp.config = cloneDeep(this.config[page][bank])
			exp.instances = {}

			if (this.bank_action_sets[page] !== undefined) {
				exp.action_sets = cloneDeep(this.bank_action_sets[page][bank])
			}

			if (this.feedbacks[page] !== undefined) {
				exp.feedbacks = cloneDeep(this.feedbacks[page][bank])
			}

			this.debug('Exported config to bank ' + page + '.' + bank)
			cb(exp)
		})

		this.system.emit('io_get', (io) => {
			this.system.on('io_connect', (socket) => {
				socket.on('loadsave_import_config', (data, answer) => {
					let object
					try {
						object = JSON.parse(data)
					} catch (e) {
						sendResult(client, answer, 'loadsave_import_config:result', 'File is corrupted or unknown format')
						return
					}

					if (object.version > file_version) {
						sendResult(
							client,
							answer,
							'loadsave_import_config:result',
							'File was saved with a newer unsupported version of Companion'
						)
						return
					}

					if (object.type == 'bank') {
						sendResult(client, answer, 'loadsave_import_config:result', 'Cannot load single banks')
						return
					}

					object = DataUpgrade.upgradeImport(object)

					// rest is done from browser
					sendResult(client, answer, 'loadsave_import_config:result', null, object)
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
					this.page.setPage(page, { name: 'PAGE' })

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

					this.page.setPage(page, { name: 'PAGE' })

					socket.emit('loadsave_reset_page:reset', null, 'ok')
				})

				socket.on('reset_all', (answer) => {
					for (let page = 1; page <= 99; ++page) {
						this.page.setPage(page, { name: 'PAGE' })

						for (let bank = 1; bank <= global.MAX_BUTTONS; ++bank) {
							this.system.emit('bank_reset', page, bank)
						}

						// make magical page buttons!
						this.system.emit('bank_style', page, 1, 'pageup')
						this.system.emit('bank_style', page, 9, 'pagenum')
						this.system.emit('bank_style', page, 17, 'pagedown')
					}

					for (const key in this.instanceData) {
						if (key != 'bitfocus-companion' && this.instanceData[key].instance_type != 'bitfocus-companion') {
							this.system.emit('instance_delete', key, this.instanceData[key].label)
						}
					}

					// reset the scheduler/triggers
					this.system.emit('schedule_clear')
					this.system.emit('custom_variables_clear')

					sendResult(client, answer, 'reset_all:result', null, 'ok')
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

					for (const key in this.instanceData) {
						if (key != 'bitfocus-companion' && this.instanceData[key].instance_type != 'bitfocus-companion') {
							this.system.emit('instance_delete', key, this.instanceData[key].label)
						}
					}

					for (const key in data.instances) {
						if (key == 'bitfocus-companion' || data.instances[key].instance_type == 'bitfocus-companion') {
							delete data.instances[key]
							continue
						}

						this.instanceData[key] = data.instances[key]
						if (data.instances[key].enabled) {
							this.system.emit('instance_activate', key)
						}
					}

					this.system.emit('custom_variables_replace_all', data.custom_variables || {})

					for (let page = 1; page <= 99; ++page) {
						if (data.page !== undefined && data.page[page] !== undefined) {
							this.page.setPage(page, data.page[page], false)
						} else {
							this.page.setPage(page, { name: 'PAGE' }, false)
						}

						for (let bank = 1; bank <= global.MAX_BUTTONS; ++bank) {
							let obj = {}

							obj.config = data.config[page][bank]

							if (data.action_sets && data.action_sets[page] && data.action_sets[page][bank]) {
								obj.action_sets = data.action_sets[page][bank]
							} else {
								obj.action_sets = {}
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

					sendResult(client, answer, 'loadsave_import_full:result', null, 'ok')
				})

				socket.on('loadsave_import_page', (topage, frompage, data) => {
					if (data.type == 'full') {
						data.page = data.page[frompage]
						data.config = data.config[frompage]
						// action sets get combined below
						data.actions = data.actions === undefined ? {} : data.actions[frompage]
						data.release_actions = data.release_actions === undefined ? {} : data.release_actions[frompage]
						data.feedbacks = data.feedbacks === undefined ? {} : data.feedbacks[frompage]
						data.action_sets = data.action_sets === undefined ? {} : data.action_sets[frompage]
					}

					if (!data.action_sets) data.action_sets = {}

					// These are no longer needed
					delete data.actions
					delete data.release_actions

					if (data.page !== undefined) {
						this.page.setPage(topage, data.page)
					} else {
						this.page.setPage(topage, { name: 'PAGE' })
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
						if (this.instanceData[instance_id]) {
							for (const bank in data.config) {
								data.config[bank].text = this.variableRename(
									data.config[bank].text,
									data.instances[key].label,
									this.instanceData[instance_id].label
								)
							}
						}

						let instance_actions = []

						for (let bank in data.action_sets) {
							for (let set in data.action_sets[bank]) {
								if (!this.instanceData[instance_id]) {
									// filter out actions from the missing instance
									data.actions[bank][set] = data.actions[bank].filter((a) => a.instance != key)
								} else {
									for (let i = 0; i < data.action_sets[bank][set].length; ++i) {
										let act = data.action_sets[bank][set][i]

										if (act.instance == key) {
											act.instance = instance_id
											act.label = act.instance + ':' + act.action
											instance_actions.push(act)
										}
									}
								}
							}
						}

						let instance_feedbacks = []
						for (const bank in data.feedbacks) {
							if (!this.instanceData[instance_id]) {
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

						if (this.instanceData[instance_id]) {
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
						obj.action_sets = data.action_sets !== undefined ? data.action_sets[bank] : {}
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

			// TODO: Rename variable definitions
			this.config[page][bank] = imp.config

			if (!imp.action_sets) {
				if (this.bank_action_sets[page] === undefined) {
					this.bank_action_sets[page] = {}
				}
				if (this.bank_action_sets[page][bank] === undefined) {
					this.bank_action_sets[page][bank] = {}
				}
			} else {
				for (let set in imp.action_sets) {
					const actions_set = imp.action_sets[set]
					for (const action of actions_set) {
						action.id = shortid.generate()
					}
				}

				this.bank_action_sets[page][bank] = imp.action_sets
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

			this.debug('Imported config to bank ' + page + '.' + bank)
			if (typeof cb == 'function') {
				cb()
			}
		})

		this.system.on('http_req', (req, res, done) => {
			let match

			generate_export_for_triggers = (triggers) => {
				const exp = {
					type: 'trigger_list',
					version: file_version,
					triggers: triggers,
					instances: {},
				}

				const instance_ids = new Set()

				for (const trigger of triggers) {
					for (const action of trigger.actions || []) {
						instance_ids.add(action.instance)
					}

					if (trigger.type === 'feedback') {
						if (Array.isArray(trigger.config)) {
							for (const fb of trigger.config) {
								instance_ids.add(fb.instance_id)
							}
						} else if (trigger.config && trigger.config.instance_id) {
							instance_ids.add(trigger.config.instance_id)
						}
					}
				}

				for (const instance_id of instance_ids) {
					if (instance_id && this.instanceData[instance_id]) {
						exp.instances[instance_id] = this.instanceData[instance_id]
					}
				}

				return exp
			}

			if ((match = req.url.match(/^\/trigger_export_all/))) {
				this.system.emit('schedule_export_all', (data) => {
					const exp = generate_export_for_triggers(data)

					res.writeHeader(200, {
						'Content-Type': 'application/json',
						'Content-Disposition':
							'attachment; filename="' + os.hostname() + '_trigger_list_' + getTimestamp() + '.companionconfig"',
					})
					res.end(JSON.stringify(exp))

					done()
				})
				return
			}

			if ((match = req.url.match(/^\/trigger_export\/(\d+)/))) {
				const id = match[1]
				if (id === null) {
					// 404 handler will take over
					return
				}

				this.system.emit('schedule_export_single', Number(id), (data) => {
					if (data) {
						const exp = generate_export_for_triggers([data])

						res.writeHeader(200, {
							'Content-Type': 'application/json',
							'Content-Disposition':
								'attachment; filename="' +
								os.hostname() +
								'_trigger_' +
								data.title.toLowerCase().replace(/\W/, '') +
								'_' +
								getTimestamp() +
								'.companionconfig"',
						})
						res.end(JSON.stringify(exp))

						done()
					}
				})
				return
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

				exp.action_sets = this.bank_action_sets[page]
				exp.feedbacks = this.feedbacks[page]

				exp.page = this.page.getPage(page, true)

				let instance_ids = new Set()

				for (const bank of Object.values(exp.action_sets)) {
					if (bank) {
						for (const action_set of Object.values(bank)) {
							for (const action of action_set) {
								instance_ids.add(action.instance)
							}
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
					if (instance_id && this.instanceData[instance_id]) {
						exp.instances[instance_id] = this.instanceData[instance_id]
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

				exp.action_sets = this.bank_action_sets

				exp.page = this.page.getAll(true)

				exp.instances = this.db.getKey('instance')

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

module.exports = DataImportExport
