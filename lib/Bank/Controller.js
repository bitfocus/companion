const fs = require('fs')
const path = require('path')
const rimraf = require('rimraf')
const Registry = require('../Registry')
const CoreBase = require('../Core/Base')
const BankAction = require('./Action')
const BankFeedback = require('./Feedback')
const { rgb, sendResult } = require('../Resources/Util')

/**
 * The class that manages the banks
 *
 * @extends CoreBase
 * @author Håkon Nessjøen <haakon@bitfocus.io>
 * @author Keith Rocheck <keith.rocheck@gmail.com>
 * @author William Viker <william@bitfocus.io>
 * @author Julian Waller <me@julusian.co.uk>
 * @since 1.0.4
 * @copyright 2022 Bitfocus AS
 * @license
 * This program is free software.
 * You should have received a copy of the MIT licence as well as the Bitfocus
 * Individual Contributor License Agreement for Companion along with
 * this program.
 *
 * You can be released from the requirements of the license by purchasing
 * a commercial license. Buying such a license is mandatory as soon as you
 * develop commercial activities involving the Companion software without
 * disclosing the source code of your own applications.
 */
class BankController extends CoreBase {
	/**
	 * The defaults for the bank fields
	 * @type {Object}
	 * @access public
	 * @static
	 */
	static DefaultFields = {
		text: '',
		size: 'auto',
		png: null,
		alignment: 'center:center',
		pngalignment: 'center:center',
		color: rgb(255, 255, 255),
		bgcolor: rgb(0, 0, 0),
		relative_delay: false,
	}

	/**
	 * @param {Registry} registry - the application core
	 */
	constructor(registry) {
		super(registry, 'bank', 'lib/Bank/Controller')

		this.config = this.db.getKey('bank', {})

		this.feedback = new BankFeedback(registry)
		this.action = new BankAction(registry)

		// Upgrade legacy png files if they exist. pre v1.2.0
		const cfgDir = this.registry.configDir

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

			this.db.setKey('bank', this.config)

			// Delete old files
			rimraf(path.join(cfgDir, 'banks'), (err) => {
				this.debug('Error cleaning up legacy pngs banks')
				this.debug('Reason:' + err)
			})
		}

		for (let x = 1; x <= 99; x++) {
			if (this.config[x] === undefined) {
				this.config[x] = {}
				for (var y = 1; y <= global.MAX_BUTTONS; y++) {
					if (this.config[x][y] === undefined) {
						this.config[x][y] = {}
					}
				}
			}
		}

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

		// Need to address this use in UIExpress
		this.system.on('bank_set_key', this.changeField.bind(this))

		this.system.on('io_connect', (client) => {
			client.on('bank_reset', (page, bank) => {
				this.system.emit('bank_reset', page, bank)
				client.emit('bank_reset', page, bank)
			})

			client.on('get_all_banks', () => {
				client.emit('get_all_banks:result', this.config)
			})

			client.on('get_bank', (page, bank, answer) => {
				sendResult(client, answer, 'get_bank:results', page, bank, this.getBank(page, bank))
			})

			client.on('hot_press', (page, button, direction) => {
				this.debug('being told from gui to hot press', page, button, direction)
				this.system.emit('bank_pressed', page, button, direction)
			})

			client.on('bank_set_png', (page, bank, dataurl, answer) => {
				if (!dataurl.match(/data:.*?image\/png/)) {
					sendResult(client, answer, 'bank_set_png:result', 'error')
					return
				}

				let data = dataurl.replace(/^.*base64,/, '')
				this.config[page][bank].png64 = data
				this.doSave()

				sendResult(client, answer, 'bank_set_png:result', 'ok')
				this.system.emit('graphics_bank_invalidate', page, bank)
			})

			client.on('bank_clear_png', (page, bank) => {
				delete this.config[page][bank].png64
				this.doSave()

				client.emit('bank_clear_png:result')
				this.system.emit('graphics_bank_invalidate', page, bank)
			})

			client.on('bank_changefield', (page, bank, key, value) => {
				this.changeField(page, bank, key, value, true)
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
				this.system.emit('bank_style', page, bank, style, () => {
					sendResult(client, answer, 'bank_style:results', page, bank, this.config[page][bank])
				})
			})
		})

		this.system.on('bank_style', (page, bank, style, cb) => {
			if (this.config[page] === undefined) this.config[page] = {}

			if (style == 'none' || this.config[page][bank] === undefined || this.config[page][bank].style === undefined) {
				this.config[page][bank] = undefined
			}

			if (style == 'none') {
				this.doSave()
				this.system.emit('action_setup_bank', page, bank, null)
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

			// Install default values
			this.config[page][bank] = {
				...this.config[page][bank],
				...BankController.DefaultFields,
			}

			this.doSave()
			this.system.emit('action_setup_bank', page, bank, style)
			this.system.emit('instance_status_check_bank', page, bank)
			this.system.emit('graphics_bank_invalidate', page, bank)
			this.system.emit('bank_style_changed', page, bank)

			if (cb !== undefined) {
				cb()
			}
		})

		this.system.on('bank_reset', (page, bank) => {
			if (this.config[page] === undefined) this.config[page] = {}
			this.config[page][bank] = {}
			this.system.emit('instance_status_check_bank', page, bank)
			this.system.emit('graphics_bank_invalidate', page, bank)
			this.system.emit('action_setup_bank', page, bank, null)
			this.doSave()
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
	}

	changeField(page, bank, key, value, invalidate = false) {
		if (this.config[page] !== undefined && this.config[page][bank] !== undefined) {
			this.config[page][bank][key] = value
			this.doSave()

			if (invalidate === true) {
				this.system.emit('graphics_bank_invalidate', page, bank)
			}
		}
	}

	doSave() {
		this.db.setKey('bank', this.config)
	}

	getBank(page, bank) {
		if (this.config[page] === undefined) {
			return {}
		} else if (this.config[page][bank] === undefined) {
			return {}
		} else {
			return this.config[page][bank]
		}
	}
}

module.exports = BankController
