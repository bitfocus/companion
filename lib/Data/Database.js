const DataStoreBase = require('./StoreBase')
const Registry = require('../Registry')
const Upgrade = require('./Upgrade')

/**
 * The class that manages the applications's main database
 *
 * @extends DataStoreBase
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
class DataDatabase extends DataStoreBase {
	/**
	 * The stored defaults for a new db
	 * @type {Object}
	 * @access protected
	 */
	static Defaults = {
		page_config_version: 3,
	}
	/**
	 * The default minimum interval in ms to save to disk (4000 ms)
	 * @type {number}
	 * @access public
	 * @static
	 */
	static SaveInterval = 4000

	/**
	 * Create a new application flat file DB controller
	 * @param {Registry} registry - the application core
	 */
	constructor(registry) {
		super(registry, 'db', DataDatabase.SaveInterval, DataDatabase.Defaults, 'lib/Data/Database')

		this.loadSync()

		Upgrade.startup(this)
	}
}

module.exports = DataDatabase
