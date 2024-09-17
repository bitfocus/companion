import { v4 } from 'uuid'
import { DataStoreBase } from './StoreBase.js'
import nodeMachineId from 'node-machine-id'

function generateMachineId() {
	try {
		return nodeMachineId.machineIdSync(true)
	} catch (e) {
		// The nodeMachineId call can fail if the machine has stricter security that blocks regedit
		// If that happens, fallback to a uuid, which while not stable, is better than nothing
		return v4()
	}
}

/**
 * The class that manages the applications's cloud config database
 *
 * @author Håkon Nessjøen <haakon@bitfocus.io>
 * @author Keith Rocheck <keith.rocheck@gmail.com>
 * @author William Viker <william@bitfocus.io>
 * @author Julian Waller <me@julusian.co.uk>
 * @since 3.0.0
 * @copyright 2023 Bitfocus AS
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
export class CloudDatabase extends DataStoreBase {
	/**
	 * The stored defaults for a new db
	 */
	private static Defaults: object = {
		uuid: generateMachineId(),
		auth: {
			token: '',
			user: '',
			connections: {},
			cloudActive: false,
		},
	}

	/**
	 * The default minimum interval in ms to save to disk (4000 ms)
	 */
	private static SaveInterval: number = 4000

	/**
	 * @param configDir - the root config directory
	 */
	constructor(configDir: string) {
		super(configDir, 'cloud', CloudDatabase.SaveInterval, CloudDatabase.Defaults, 'Data/CloudDatabase')

		this.loadSync()
	}
}
