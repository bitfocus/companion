import DataStoreBase from './StoreBase.js'

/**
 * The class that manages the applications's disk cache
 *
 * @extends DataStoreBase
 * @author Håkon Nessjøen <haakon@bitfocus.io>
 * @author Keith Rocheck <keith.rocheck@gmail.com>
 * @author William Viker <william@bitfocus.io>
 * @author Julian Waller <me@julusian.co.uk>
 * @since 2.3.0
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
class DataCache extends DataStoreBase {
	/**
	 * The stored defaults for a new cache
	 * @type {Object}
	 * @access protected
	 */
	static Defaults = {}
	/**
	 * The default minimum interval in ms to save to disk (30000 ms)
	 * @type {number}
	 * @access public
	 * @static
	 */
	static SaveInterval = 30000

	/**
	 * @param {string} configDir - the root config directory
	 */
	constructor(configDir) {
		super(configDir, 'datacache', DataCache.SaveInterval, DataCache.Defaults, 'Data/Cache')

		this.loadSync()
	}
}

export default DataCache
