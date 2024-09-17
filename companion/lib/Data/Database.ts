import { DataStoreBase } from './StoreBase.js'
import { upgradeStartup } from './Upgrade.js'

/**
 * The class that manages the applications's main database
 *
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
export class DataDatabase extends DataStoreBase {
	/**
	 * The stored defaults for a new db
	 */
	static Defaults: object = {
		page_config_version: 3,
	}
	/**
	 * The default minimum interval in ms to save to disk (4000 ms)
	 */
	private static SaveInterval: number = 4000

	/**
	 * @param configDir - the root config directory
	 */
	constructor(configDir: string) {
		super(configDir, 'db', DataDatabase.SaveInterval, DataDatabase.Defaults, 'Data/Database')

		this.loadSync()

		upgradeStartup(this)
	}
}
