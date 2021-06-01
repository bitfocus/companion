const DataStoreBase = require('./StoreBase')
const fs = require('fs-extra')

/**
 * The class that manages the applications's config database
 *
 * @extends DataStoreBase
 * @author Håkon Nessjøen <haakon@bitfocus.io>
 * @author Julian Waller <me@julusian.co.uk>
 * @author Keith Rocheck <keith.rocheck@gmail.com>
 * @author William Viker <william@bitfocus.io>
 * @since 2.2.0
 * @copyright 2021 Bitfocus AS
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
class Config extends DataStoreBase {
	/**
	 * The default minimum interval in ms to save to disk (4000 ms)
	 * @type {number}
	 * @static
	 */
	static SaveCycle = 5000

	/**
	 * The debugger for this class
	 * @type {debug.Debugger}
	 * @access protected
	 */
	debug = require('debug')('Data/Config')

	/**
	 * @param {Registry} registry - the core registry
	 * @param {string} cfgDir - the directory the flat file will be saved
	 * @param {Object} defaults - the default data to use when making a new file
	 */
	constructor(registry, cfgDir, defaults) {
		super(registry, 'config', cfgDir, Config.SaveCycle, defaults)

		if (!fs.existsSync(this.cfgDir)) {
			this.debug('no config dir exists. creating:', this.cfgDir)
			fs.mkdirSync(this.cfgDir)
		}

		this.loadSync()
	}
}

exports = module.exports = Config
