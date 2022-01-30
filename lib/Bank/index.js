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
const path = require('path')
const rimraf = require('rimraf')
const { cloneDeep } = require('lodash')
const { from12to32, from15to32, rgb, sendResult } = require('../Resources/Util')
const App = require('../../app')

exports = module.exports = function (system) {
	return new Bank(system)
}

class Bank {
	debug = require('debug')('lib/Bank')

	/**
	 * @param {App} system
	 */
	constructor(system) {
		this.system = system
		this.config = {}

		this.feedback = require('./Feedback')(system)
		this.action = require('./Action')(system)

		this.fields = {
			png: [
				{
					type: 'textinput',
					id: 'text',
					label: 'Text',
					width: 6,
					default: '',
				},

				{
					type: 'dropdown',
					id: 'size',
					label: 'Font size',
					default: 'auto',
					choices: [
						{ id: '7', label: '7pt' },
						{ id: '14', label: '14pt' },
						{ id: '18', label: '18pt' },
						{ id: '24', label: '24pt' },
						{ id: '30', label: '30pt' },
						{ id: '44', label: '44pt' },
						{ id: 'auto', label: 'Auto' },
					],
					width: 3,
				},

				// Changed from 58 to 72 (Height)
				{
					type: 'filepicker',
					id: 'png',
					label: '72x58 PNG',
					accept: 'image/png',
					width: 3,
					imageMinWidth: 72,
					imageMinHeight: 58,
					imageMaxWidth: 72,
					imageMaxHeight: 72,
				},
				{
					type: 'alignmentcontrol',
					id: 'alignment',
					label: 'Text Alignment',
					width: 2,
					default: 'center:center',
				},

				{
					type: 'alignmentcontrol',
					id: 'pngalignment',
					label: 'PNG Alignment',
					width: 2,
					default: 'center:center',
				},

				{
					type: 'colorpicker',
					id: 'color',
					label: 'Color',
					width: 2,
					default: rgb(255, 255, 255),
				},

				{
					type: 'colorpicker',
					id: 'bgcolor',
					label: 'Background',
					width: 2,
					default: rgb(0, 0, 0),
				},

				{
					type: 'checkbox',
					id: 'latch',
					label: 'Latch/Toggle',
					width: 2,
					default: false,
				},

				{
					type: 'checkbox',
					id: 'relative_delay',
					label: 'Relative Delays',
					width: 2,
					default: false,
				},
			],
		}

		const convertConfig15to32 = () => {
			let old_config, old_bank_actions, old_bank_release_actions, old_feedbacks

			const exportOldConfig = (page, bank) => {
				let exp = {}

				exp.config = cloneDeep(old_config[page][bank])
				exp.instances = {}

				if (old_bank_actions[page] !== undefined) {
					exp.actions = cloneDeep(old_bank_actions[page][bank])
				}

				if (old_bank_release_actions[page] !== undefined) {
					exp.release_actions = cloneDeep(old_bank_release_actions[page][bank])
				}

				if (old_feedbacks[page] !== undefined) {
					exp.feedbacks = cloneDeep(old_feedbacks[page][bank])
				}

				return exp
			}

			this.system.emit('db_get', 'bank', (res) => {
				this.config = res

				old_config = cloneDeep(res)
			})
			this.system.emit('action_get_banks', (bank_actions) => {
				old_bank_actions = cloneDeep(bank_actions)
			})

			this.system.emit('release_action_get_banks', (bank_release_actions) => {
				old_bank_release_actions = cloneDeep(bank_release_actions)
			})

			this.system.emit('feedback_getall', (feedbacks) => {
				old_feedbacks = cloneDeep(feedbacks)
			})

			if (this.config === undefined) {
				this.config = {}
				this.system.emit('db_set', 'bank', this.config)
			}
			if (old_bank_actions === undefined) {
				old_bank_actions = {}
			}
			if (old_bank_actions === undefined) {
				old_bank_actions = {}
			}

			for (let page = 1; page <= 99; ++page) {
				if (this.config[page] === undefined) {
					this.config[page] = {}
				}

				// Reset
				for (let i = 0; i < 32; ++i) {
					this.system.emit('bank_reset', page, i + 1)
				}

				// Add navigation keys
				this.system.emit('import_bank', page, 1, { config: { style: 'pageup' } })
				this.system.emit('import_bank', page, 9, { config: { style: 'pagenum' } })
				this.system.emit('import_bank', page, 17, { config: { style: 'pagedown' } })

				// Move keys around
				for (const b in old_config[page]) {
					let old = exportOldConfig(page, b)

					this.system.emit('import_bank', page, from12to32(b), old)
				}
			}

			this.system.emit('db_set', 'bank', this.config)
			this.system.emit('db_set', 'page_config_version', 2)
		}

		this.system.emit('db_get', 'page_config_version', (res) => {
			if (res === undefined || res < 2) {
				// Tell all config loaders to update config to new format
				this.system.emit('15to32')

				for (const page in this.config) {
					for (let bank = 1; bank <= global.MAX_BUTTONS; ++bank) {
						if (this.config[page][bank] === undefined) {
							this.config[page][bank] = {}
						}
					}
				}

				// Convert config from 15 to 32 (move banks around to new setup)
				this.system.on('modules_loaded', convertConfig15to32)
			} else if (res > 2) {
				const errorMsg =
					'You have previously installed a much newer version of companion. Since the configuration files are incompatible between major versions of companion, you need to remove the old config before continuing with this version.'
				try {
					var dialog = require('electron').dialog
					dialog.showErrorBox('Error starting companion', errorMsg)
				} catch (e) {
					console.error(errorMsg)
				}
				process.exit(1)
			}
		})

		this.system.emit('db_get', 'bank', (res) => {
			//this.debug("LOADING ------------",res);
			if (res !== undefined) {
				this.config = res

				/* Fix pre-v1.1.0 and pre-v2.0.0 config for banks */
				for (const page in this.config) {
					for (const bank in this.config[page]) {
						if (this.config[page][bank].style !== undefined) {
							switch (this.config[page][bank].style) {
								case 'text':
									this.config[page][bank].style = 'png'
									break
								case 'bigtext':
									this.config[page][bank].style = 'png'
									this.config[page][bank].size = 'large'
									break
								case 'smalltext':
									this.config[page][bank].style = 'png'
									this.config[page][bank].size = 'small'
									break
							}
						}
					}
				}

				// Upgrade legacy png files if they exist. pre v1.2.0
				const cfgDir = this.system.configDir
				if (fs.existsSync(path.join(cfgDir, 'banks'))) {
					for (const page in this.config) {
						if (this.config[page]) {
							for (const bank in this.config[page]) {
								if (this.config[page][bank] && this.config[page][bank].style) {
									const fullPath = path.join(cfgDir, 'banks', `${page}_${bank}.png`)
									try {
										if (fs.existsSync(fullPath)) {
											const data = fs.readFileSync(fullPath, 'base64')
											this.config[page][bank].png64 = data
										}
									} catch (e) {
										this.debug('Error upgrading config to inline png for bank ' + page + '.' + bank)
										this.debug('Reason:' + e.message)
									}
								}
							}
						}
					}

					this.system.emit('db_set', 'bank', this.config)
					this.system.emit('db_save')

					// Delete old files
					rimraf(path.join(cfgDir, 'banks'), (err) => {
						this.debug('Error cleaning up legacy pngs banks')
						this.debug('Reason:' + err)
					})
				}
			} else {
				for (let x = 1; x <= 99; x++) {
					if (this.config[x] === undefined) {
						this.config[x] = {}
						for (let y = 1; y <= global.MAX_BUTTONS; y++) {
							if (this.config[x][y] === undefined) {
								this.config[x][y] = {}
							}
						}
					}
				}
				this.system.emit('db_set', 'page_config_version', 2)
			}
		})

		/* Variable jiu jitsu */
		this.system.on('variables_changed', (changed_variables, removed_variables) => {
			const all_changed_variables = [...removed_variables, ...Object.keys(changed_variables)]

			if (all_changed_variables.length > 0) {
				for (const page in this.config) {
					for (const bank in this.config[page]) {
						let data = this.config[page][bank]

						let text = data.text
						this.system.emit('feedback_get_style', page, bank, (style) => {
							if (style !== undefined) {
								if (typeof style.text === 'string') {
									text = style.text
								}
							}
						})

						if (typeof text === 'string') {
							for (const variable of all_changed_variables) {
								if (text.includes(`$(${variable})`)) {
									this.debug('variable changed in bank ' + page + '.' + bank)
									this.system.emit('graphics_bank_invalidate', page, bank)
									break
								}
							}
						}
					}
				}
			}
		})

		this.system.on('bank_update', (cfg) => {
			this.debug('bank_update saving')
			this.config = cfg // in case new reference
			this.system.emit('db_set', 'bank', cfg)
			this.system.emit('db_save')
		})

		this.system.on('bank_set_key', (page, bank, key, val) => {
			if (this.config[page] !== undefined && this.config[page][bank] !== undefined) {
				this.config[page][bank][key] = val
				this.system.emit('db_set', 'bank', this.config)
				this.system.emit('db_save')
			}
		})

		this.system.on('bank_changefield', (page, bank, key, val) => {
			this.config[page][bank][key] = val
			this.system.emit('bank_update', this.config)
			this.system.emit('graphics_bank_invalidate', page, bank)
		})

		this.system.on('io_connect', (client) => {
			client.on('graphics_preview_generate', (config, answer) => {
				this.system.emit('graphics_preview_generate', config, (img) => {
					answer(img)
				})
			})

			client.on('bank_reset', (page, bank) => {
				this.system.emit('bank_reset', page, bank)
				client.emit('bank_reset', page, bank)
			})

			client.on('get_all_banks', () => {
				client.emit('get_all_banks:result', this.config)
			})

			client.on('get_bank', (page, bank, answer) => {
				this.system.emit('get_bank', page, bank, (config) => {
					let fields = []
					if (config.style !== undefined && this.fields[config.style] !== undefined) {
						fields = this.fields[config.style]
					}

					sendResult(answer, 'get_bank:results', page, bank, config, fields)
				})
			})

			client.on('hot_press', (page, button, direction) => {
				this.debug('being told from gui to hot press', page, button, direction)
				this.system.emit('bank_pressed', page, button, direction)
			})

			client.on('bank_set_png', (page, bank, dataurl, answer) => {
				if (!dataurl.match(/data:.*?image\/png/)) {
					sendResult(answer, 'bank_set_png:result', 'error')
					return
				}

				let data = dataurl.replace(/^.*base64,/, '')
				this.config[page][bank].png64 = data
				this.system.emit('bank_update', this.config)

				sendResult(answer, 'bank_set_png:result', 'ok')
				this.system.emit('graphics_bank_invalidate', page, bank)
			})

			client.on('bank_clear_png', (page, bank) => {
				delete this.config[page][bank].png64
				this.system.emit('bank_update', this.config)

				client.emit('bank_clear_png:result')
				this.system.emit('graphics_bank_invalidate', page, bank)
			})

			client.on('bank_changefield', (page, bank, key, val) => {
				this.system.emit('bank_changefield', page, bank, key, val)
			})

			client.on('bank_copy', (pagefrom, bankfrom, pageto, bankto) => {
				if (pagefrom != pageto || bankfrom != bankto) {
					let exp

					this.system.emit('export_bank', pagefrom, bankfrom, (_exp) => {
						exp = _exp
					})

					this.system.emit('import_bank', pageto, bankto, exp)
				}

				client.emit('bank_copy:result', null, 'ok')
			})

			client.on('bank_move', (pagefrom, bankfrom, pageto, bankto) => {
				if (pagefrom != pageto || bankfrom != bankto) {
					let exp

					this.system.emit('export_bank', pagefrom, bankfrom, (_exp) => {
						exp = _exp
					})
					this.system.emit('import_bank', pageto, bankto, exp)
					this.system.emit('bank_reset', pagefrom, bankfrom)
				}

				client.emit('bank_move:result', null, 'ok')
			})

			client.on('bank_style', (page, bank, style, answer) => {
				this.system.emit('bank_style', page, bank, style, (fields) => {
					sendResult(answer, 'bank_style:results', page, bank, this.config[page][bank], fields)
				})
			})

			client.on('disconnect', () => {
				// In theory not needed. But why not.
				client.removeAllListeners('graphics_preview_generate')
				client.removeAllListeners('bank_reset')
				client.removeAllListeners('get_all_banks')
				client.removeAllListeners('get_bank')
				client.removeAllListeners('hot_press')
				client.removeAllListeners('bank_set_png')
				client.removeAllListeners('bank_changefield')
				client.removeAllListeners('bank_copy')
				client.removeAllListeners('bank_move')
				client.removeAllListeners('bank_style')
			})
		})

		this.system.on('bank_style', (page, bank, style, cb) => {
			if (this.config[page] === undefined) this.config[page] = {}

			if (style == 'none' || this.config[page][bank] === undefined || this.config[page][bank].style === undefined) {
				this.config[page][bank] = undefined
			}

			if (style == 'none') {
				this.system.emit('bank_update', this.config, undefined)
				this.system.emit('graphics_bank_invalidate', page, bank)
				this.system.emit('bank_style_changed', page, bank)
				cb(undefined)
				return
			} else if (style == 'pageup') {
				this.system.emit('bank_reset', page, bank)
			} else if (style == 'pagenum') {
				this.system.emit('bank_reset', page, bank)
			} else if (style == 'pagedown') {
				this.system.emit('bank_reset', page, bank)
			}

			this.config[page][bank] = {
				style: style,
			}

			let fields = []
			if (this.fields[style] !== undefined) {
				fields = this.fields[style]
			}

			// Install default values
			for (let i = 0; i < fields.length; ++i) {
				if (fields[i].default !== undefined) {
					this.config[page][bank][fields[i].id] = fields[i].default
				}
			}

			this.system.emit('bank_update', this.config, fields)
			this.system.emit('instance_status_check_bank', page, bank)
			this.system.emit('graphics_bank_invalidate', page, bank)
			this.system.emit('bank_style_changed', page, bank)

			if (cb !== undefined) {
				cb(fields)
			}
		})

		this.system.on('bank_reset', (page, bank) => {
			if (this.config[page] === undefined) this.config[page] = {}
			this.config[page][bank] = {}
			this.system.emit('instance_status_check_bank', page, bank)
			this.system.emit('graphics_bank_invalidate', page, bank)
			this.system.emit('bank_update', this.config)
			this.system.emit('bank_style_changed', page, bank)
		})

		this.system.on('bank_rename_variables', (from, to) => {
			for (const page in this.config) {
				for (const bank in this.config[page]) {
					if (this.config[page][bank].style !== undefined && this.config[page][bank].text !== undefined) {
						this.system.emit('variable_rename_callback', this.config[page][bank].text, from, to, (result) => {
							if (this.config[page][bank].text !== result) {
								this.debug('rewrote ' + this.config[page][bank].text + ' to ' + result)
								this.config[page][bank].text = result
							}
						})
					}
				}
			}
		})

		this.system.on('get_all_banks', (cb) => {
			cb(this.config)
		})

		this.system.on('get_banks_for_page', (page, cb) => {
			if (this.config[page] === undefined) cb({})
			else cb(this.config[page])
		})

		this.system.on('get_bank', (page, bank, cb) => {
			if (this.config[page] === undefined) cb({})
			else if (this.config[page][bank] === undefined) cb({})
			else cb(this.config[page][bank])
		})

		this.system.on('bank_update_request', () => {
			this.system.emit('bank_update', this.config)
		})

		this.system.on('ready', () => {
			this.system.emit('bank_update', this.config)
		})

		this.system.on('bank_get15to32', (key, cb) => {
			cb(from15to32(key))
		})
		this.system.on('bank_get12to32', (key, cb) => {
			cb(from12to32(key))
		})
	}
}
