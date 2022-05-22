import fs from 'fs-extra'
import path from 'path'
import { cloneDeep } from 'lodash-es'
import Registry from '../Registry.js'
import CoreBase from '../Core/Base.js'
import { rgb } from '../Resources/Util.js'

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
	 * @param {Registry} registry - the application core
	 */
	constructor(registry) {
		super(registry, 'bank', 'Bank/Controller')

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

		// this.action.checkBankStatus(page, bank)

		if (save === true) {
			this.doSave()
		}

		if (invalidate === true) {
			this.graphics.invalidateBank(page, bank)
			this.preview.updateWebButtonsPage(page)
		}
	}
}

export default BankController
