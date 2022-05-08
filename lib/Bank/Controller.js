import fs from 'fs-extra'
import path from 'path'
import { cloneDeep } from 'lodash-es'
import Registry from '../Registry.js'
import CoreBase from '../Core/Base.js'
import BankAction from './Action.js'
import BankFeedback from './Feedback.js'
import { rgb, sendResult } from '../Resources/Util.js'

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
	 * The action controller
	 * @type {BankAction}
	 * @access public
	 */
	action
	/**
	 * The bank style data
	 * @type {Object}
	 * @access protected
	 */
	config
	/**
	 * The feedback controller
	 * @type {BankFeedback}
	 * @access public
	 */
	feedback

	/**
	 * @param {Registry} registry - the application core
	 */
	constructor(registry) {
		super(registry, 'bank', 'Bank/Controller')

		this.config = this.db.getKey('bank', {})

		this.feedback = new BankFeedback(registry)
		this.action = new BankAction(registry)

		this.pushed = {}

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
								this.logger.silly('Error upgrading config to inline png for bank ' + page + '.' + bank)
								this.logger.silly('Reason:' + e.message)
							}
						}
					}
				}
			}

			this.db.setKey('bank', this.config)

			// Delete old files
			try {
				fs.removeSync(path.join(cfgDir, 'banks'))
			} catch (e) {
				this.logger.silly('Error cleaning up legacy pngs banks')
				this.logger.silly('Reason:' + err)
			}
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
	}

	/**
	 * Scan the actions and feedbacks for any instances that disappeared
	 * @access public
	 */
	verifyInstanceIds() {
		this.action.verifyInstanceIds()
		this.feedback.verifyInstanceIds()
	}

	deleteInstance(instanceId) {
		this.action.deleteInstance(instanceId)
		this.feedback.deleteInstance(instanceId)
	}

	/**
	 * Set whether a bank is pushed
	 * @param {number} page
	 * @param {number} bank
	 * @param {boolean} pushed
	 * @param {string | undefined} deviceId - Surface that originated the change
	 */
	setPushed(page, bank, pushed, deviceId) {
		this.pushed[`${page}_${bank}`] = !!pushed
		this.graphics.invalidateBank(page, bank)

		this.services.emberplus.updateBankState(page, bank, pushed, deviceId)
	}

	/**
	 * Check if a bank is pushed
	 * @param {number} page
	 * @param {number} bank
	 */
	isPushed(page, bank) {
		return !!this.pushed[`${page}_${bank}`]
	}

	/**
	 * Setup a new socket client's events
	 * @param {SocketIO} client - the client socket
	 * @access public
	 */
	clientConnect(client) {
		this.action.clientConnect(client)
		this.feedback.clientConnect(client)

		client.on('bank_reset', (page, bank) => {
			this.resetBank(page, bank)
			client.emit('bank_reset', page, bank)
		})

		client.on('get_all_banks', () => {
			client.emit('get_all_banks:result', this.config)
		})

		client.on('get_bank', (page, bank, answer) => {
			sendResult(client, answer, 'get_bank:results', page, bank, this.get(page, bank))
		})

		client.on('bank_set_png', this.setPNG.bind(this, client))
		client.on('bank_clear_png', this.clearPNG.bind(this.action, client))
		client.on('bank_changefield', this.changeField.bind(this))
		client.on('bank_copy', this.copyBank.bind(this, client))
		client.on('bank_move', this.moveBank.bind(this, client))
		// Future UI implementation
		client.on('bank_swap', this.swapBanks.bind(this, client))

		client.on('bank_style', (page, bank, style, answer) => {
			this.setBankStyle(page, bank, style)
			sendResult(client, answer, 'bank_style:results', page, bank, this.get(page, bank))
		})
	}

	/**
	 * Get the complete style object of a bank
	 * @param {number} page
	 * @param {number} bank
	 * @returns
	 */
	getBankCompleteStyle(page, bank) {
		const rawStyle = this.config[page]?.[bank]
		if (rawStyle) {
			let style = { ...rawStyle }

			const bankId = `${page}_${bank}`

			if (style.style !== 'pageup' && style.style !== 'pagedown' && style.style !== 'pagenum') {
				// Fetch feedback-overrides for bank
				const feedbackStyle = this.feedback.getStyleForBank(page, bank)
				if (feedbackStyle) {
					style = {
						...style,
						...feedbackStyle,
					}
				}

				if (style.text) {
					style.text = this.instance.variable.parseVariables(style.text)
				}

				if (style.style == 'step') {
					style['step_cycle'] = parseInt(this.action.getBankActiveStep(page, bank)) + 1
				}

				style.pushed = !!this.pushed[bankId]
				style.action_running = this.action.actions_running.has(bankId)
				style.bank_status = this.action.getBankStatus(page, bank)
			}

			return cloneDeep(style)
		} else {
			return undefined
		}
	}

	/**
	 * Get the unparsed text for a bank
	 * @param {number} page
	 * @param {number} bank
	 * @returns
	 */
	getBankRawText(page, bank) {
		const rawStyle = this.config[page]?.[bank]
		if (rawStyle) {
			let text = rawStyle.text

			if (rawStyle.style !== 'pageup' && rawStyle.style !== 'pagedown' && rawStyle.style !== 'pagenum') {
				// Fetch feedback-overrides for bank
				const feedbackStyle = this.feedback.getStyleForBank(page, bank)
				if (feedbackStyle && 'text' in feedbackStyle) {
					text = feedbackStyle.text
				}
			}

			return text
		} else {
			return undefined
		}
	}

	/**
	 * Update a style field for a bank
	 * @param {number} page - the page number
	 * @param {number} bank - the bank number
	 * @param {string} key - the style key
	 * @param {any} value - the new style value
	 * @param {boolean} [invalidate = true] - <code>false</code> if the bank graphics should invalidate
	 * @access public
	 */
	changeField(page, bank, key, value, invalidate = true) {
		if (this.config[page] !== undefined && this.config[page][bank] !== undefined) {
			this.config[page][bank][key] = value
			this.doSave()

			if (invalidate === true) {
				this.graphics.invalidateBank(page, bank)
			}
		}
	}

	/**
	 * Clear the PNG in a bank from the UI
	 * @param {SocketIO} client - the client socket
	 * @param {number} page - the page number
	 * @param {number} bank - the bank number
	 * @access protected
	 */
	clearPNG(client, page, bank) {
		delete this.config[page][bank].png64
		this.doSave()

		client.emit('bank_clear_png:result')
		this.graphics.invalidateBank(page, bank)
	}

	/**
	 * Copy a bank to another bank from the UI
	 * @param {SocketIO} client - the client socket
	 * @param {number} pagefrom - the page number to copy
	 * @param {number} bankfrom - the bank number to copy
	 * @param {number} pageto - the page number to paste to
	 * @param {number} bankto - the bank number to paste to
	 * @access protected
	 */
	copyBank(client, pagefrom, bankfrom, pageto, bankto) {
		if (pagefrom != pageto || bankfrom != bankto) {
			const exp = this.exportBank(pagefrom, bankfrom)

			this.importBank(pageto, bankto, exp)
		}

		client.emit('bank_copy:result', null, 'ok')
	}

	/**
	 * Save changes
	 * @access protected
	 */
	doSave() {
		this.db.setKey('bank', this.config)
	}

	/**
	 * Save changes (including actions and feedbacks)
	 * @access protected
	 */
	doSaveAll() {
		this.db.setKey('bank', this.config)
		//this.action.doSave()
		this.feedback.doSave()
	}

	/**
	 * Get a bank configuration
	 * @param {number} page - the page number
	 * @param {number} bank - the bank number
	 * @param {boolean} [clone = false] - <code>true</code> if a copy should be returned
	 * @returns {Object} the bank
	 * @access public
	 */
	get(page, bank, clone = false) {
		let out

		if (this.config[page] === undefined) {
			out = {}
		} else if (this.config[page][bank] === undefined) {
			out = {}
		} else {
			if (clone === true) {
				out = cloneDeep(this.config[page][bank])
			} else {
				out = this.config[page][bank]
			}
		}

		return out
	}

	/**
	 * Get the entire page/bank table
	 * @param {boolean} [clone = false] - <code>true</code> if a copy should be returned
	 * @returns {Object} the banks
	 * @access public
	 */
	getAll(clone = false) {
		let out

		if (this.config !== undefined) {
			if (clone === true) {
				out = cloneDeep(this.config)
			} else {
				out = this.config
			}
		}

		return out
	}

	/**
	 * Get the banks for a page
	 * @param {number} page - the page to get
	 * @param {boolean} [clone = false] - <code>true</code> if a copy should be returned
	 * @returns {Object} the banks
	 * @access public
	 */
	getPageBanks(page, clone = false) {
		let out

		if (this.config[page] !== undefined) {
			if (clone === true) {
				out = cloneDeep(this.config[page])
			} else {
				out = this.config[page]
			}
		} else {
			out = {}
		}

		return out
	}

	/**
	 * Import a bank
	 * @param {number} page - the page number
	 * @param {number} bank - the bank number
	 * @param {Object} imp - the import config
	 * @param {boolean} [invalidate = true] - <code>false</code> if a graphics invalidate isn't necessary
	 * @param {boolean} [save = true] - <code>false</code> if an save isn't necessary
	 * @access public
	 */
	importBank(page, bank, imp, invalidate = true, save = true) {
		this.resetBank(page, bank, false, false)

		if (imp.config === undefined) {
			imp.config = {}
		}

		this.config[page][bank] = imp.config

		this.action.importBank(page, bank, imp.action_sets)
		this.feedback.importBank(page, bank, imp.feedbacks)

		if (invalidate === true) {
			this.graphics.invalidateBank(page, bank)
		}

		if (save === true) {
			this.doSaveAll()
		}

		this.logger.silly('Imported config to bank ' + page + '.' + bank)
	}

	exportBank(page, bank) {
		const exp = {
			config: cloneDeep(this.config[page][bank]),
			action_sets: this.action.exportBank(page, bank),
			feedbacks: this.feedback.exportBank(page, bank),
		}

		this.logger.silly('Exported config to bank ' + page + '.' + bank)
		return exp
	}

	/**
	 * Move a bank to a different bank from the UI
	 * @param {SocketIO} client - the client socket
	 * @param {number} pagefrom - the page number to copy
	 * @param {number} bankfrom - the bank number to copy
	 * @param {number} pageto - the page number to paste to
	 * @param {number} bankto - the bank number to paste to
	 * @access protected
	 */
	moveBank(client, pagefrom, bankfrom, pageto, bankto) {
		if (pagefrom != pageto || bankfrom != bankto) {
			const exp = this.exportBank(pagefrom, bankfrom)

			this.importBank(pageto, bankto, exp)
			this.resetBank(pagefrom, bankfrom)
		}

		client.emit('bank_move:result', null, 'ok')
	}

	/**
	 * Populate variable changes to the banks
	 * @param {Object} changedVariables - variables with text changes
	 * @param {Object} removedVariables - variables that have been removed
	 * @access public
	 */
	onVariablesChanged(changedVariables, removedVariables) {
		const allChangedVariables = [...removedVariables, ...Object.keys(changedVariables)]

		if (allChangedVariables.length > 0) {
			for (const page in this.config) {
				for (const bank in this.config[page]) {
					const text = this.getBankRawText(page, bank)

					if (typeof text === 'string') {
						for (const variable of allChangedVariables) {
							if (text.includes(`$(${variable})`)) {
								this.logger.silly('variable changed in bank ' + page + '.' + bank)
								this.graphics.invalidateBank(page, bank)
								break
							}
						}
					}
				}
			}
		}
	}

	/**
	 * Rename an instance for variables used in the banks
	 * @param {string} fromlabel - the old instance short name
	 * @param {string} tolabel - the new instance short name
	 * @access public
	 */
	renameVariables(fromlabel, tolabel) {
		for (const page in this.config) {
			for (const bank in this.config[page]) {
				const pageStyle = this.config[page][bank]
				if (pageStyle && pageStyle.style && pageStyle.text !== undefined) {
					this.instance.variable.renameVariablesInString(pageStyle.text, fromlabel, tolabel, (result) => {
						if (pageStyle.text !== result) {
							this.logger.silly('rewrote ' + pageStyle.text + ' to ' + result)
							pageStyle.text = result
						}
					})
				}
			}
		}
	}

	/**
	 * Empty a bank
	 * @param {number} page - the page number
	 * @param {number} bank - the bank number
	 * @param {boolean} [invalidate = true] - <code>false</code> if a graphics invalidate isn't necessary
	 * @param {boolean} [save = true] - <code>false</code> if an save isn't necessary
	 * @access public
	 */
	resetBank(page, bank, invalidate = true, save = true) {
		if (this.config[page] === undefined) this.config[page] = {}
		this.config[page][bank] = {}

		this.action.resetBank()
		this.feedback.resetBank()

		this.action.checkBankStatus(page, bank)

		if (save === true) {
			this.doSave()
		}

		if (invalidate === true) {
			this.graphics.invalidateBank(page, bank)
			this.preview.updateWebButtonsPage(page)
		}
	}

	/**
	 * Set a bank to a new style/type
	 * @param {number} page - the page number
	 * @param {number} bank - the bank number
	 * @param {style} style - the new style
	 * @access public
	 */
	setBankStyle(page, bank, style) {
		if (this.config[page] === undefined) this.config[page] = {}

		if (style == 'none' || this.config[page][bank] === undefined || this.config[page][bank].style === undefined) {
			this.config[page][bank] = undefined
		}

		if (style == 'none') {
			this.doSave()
			this.action.setupBank(page, bank, null)
			this.graphics.invalidateBank(page, bank)
			this.preview.updateWebButtonsPage(page)
			cb(undefined)
			return
		} else if (style == 'pageup') {
			this.bank.resetBank(page, bank)
		} else if (style == 'pagenum') {
			this.bank.resetBank(page, bank)
		} else if (style == 'pagedown') {
			this.bank.resetBank(page, bank)
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
		this.action.setupBank(page, bank, style)
		this.action.checkBankStatus(page, bank)
		this.graphics.invalidateBank(page, bank)
		this.preview.updateWebButtonsPage(page)
	}

	/**
	 * Set a bank PNG from the UI
	 * @param {SocketIO} client - the client socket
	 * @param {number} page - the page number
	 * @param {number} bank - the bank number
	 * @param {string} dataurl - the <code>base64</code> image data
	 * @param {function} answer - React callback
	 * @access protected
	 */
	setPNG(client, page, bank, dataurl, answer) {
		if (!dataurl.match(/data:.*?image\/png/)) {
			sendResult(client, answer, 'bank_set_png:result', 'error')
			return
		}

		let data = dataurl.replace(/^.*base64,/, '')
		this.config[page][bank].png64 = data
		this.doSave()

		sendResult(client, answer, 'bank_set_png:result', 'ok')
		this.graphics.invalidateBank(page, bank)
	}

	/**
	 * Swap the guts of two banks in the UI
	 * @param {SocketIO} client - the client socket
	 * @param {number} page1 - the page number to copy
	 * @param {number} bank1 - the bank number to copy
	 * @param {number} page2 - the page number to paste to
	 * @param {number} bank2 - the bank number to paste to
	 * @access protected
	 */
	swapBanks(client, page1, bank1, page2, bank2) {
		if (pagefrom != pageto || bankfrom != bankto) {
			const exp1 = this.exportBank(page1, bank1)
			const exp2 = this.exportBank(page2, bank2)

			this.importBank(page1, bank1, exp2)
			this.importBank(page2, bank2, exp1)
		}

		client.emit('bank_swap:result', null, 'ok')
	}
}

export default BankController
