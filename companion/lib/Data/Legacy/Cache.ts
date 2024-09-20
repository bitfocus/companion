import { DataLegacyStoreBase } from './StoreBase.js'

/**
 * The class that manages the applications's disk cache
 *
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
export class DataLegacyCache extends DataLegacyStoreBase {
	/**
	 * @param configDir - the root config directory
	 */
	constructor(configDir: string) {
		super(configDir, 'datacache', 'Data/Legacy/Cache')

		this.loadSync()
	}
}