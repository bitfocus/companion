import { DataLegacyStoreBase } from './StoreBase.js'

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
 */
export class DataLegacyDatabase extends DataLegacyStoreBase {
	/**
	 * @param configDir - the root config directory
	 */
	constructor(configDir: string) {
		super(configDir, 'db', 'Data/Legacy/Database')

		this.loadSync()
	}
}
