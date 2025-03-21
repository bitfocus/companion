import OSC from 'osc'
import { ServiceOscBase } from './OscBase.js'
import { OSCSomeArguments } from '@companion-module/base'
import type { DataUserConfig } from '../Data/UserConfig.js'

/**
 * Class providing OSC send services.
 *
 * @author Håkon Nessjøen <haakon@bitfocus.io>
 * @author Keith Rocheck <keith.rocheck@gmail.com>
 * @author William Viker <william@bitfocus.io>
 * @author Julian Waller <me@julusian.co.uk>
 * @since 1.0.7
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
export class ServiceOscSender extends ServiceOscBase {
	constructor(userconfig: DataUserConfig) {
		super(userconfig, 'Service/OscSender', null, null)

		this.port = 0

		this.init()
	}

	/**
	 * Process an incoming message from a client
	 */
	protected override processIncoming() {}

	/**
	 * Send an OSC command to a host
	 * @param host - the receiving host
	 * @param port - the receiving port
	 * @param path - the OSC path
	 * @param args - arguments to include
	 */
	send(host: string, port: number, path: string, args: OSCSomeArguments) {
		if (this.server !== undefined) {
			this.server.send(
				{
					address: path,
					args: args,
				},
				host,
				port
			)
		}
	}

	/**
	 * Send multiple OSC commands to a host
	 * @param host - the receiving host
	 * @param port - the receiving port
	 * @param time - OSC 64-bit time tag (see OSC specification); <code>0</code> to send immediately
	 * @param bundle - the packages to send
	 */
	sendBundle(host: string, port: number, time: number, bundle: ServiceOscSender_CompanionOSCBundle) {
		if (this.server !== undefined && bundle !== undefined) {
			this.server.send(
				{
					// @ts-ignore
					timeTag: OSC.timeTag(time),
					packets: bundle,
				},
				host,
				port
			)
		}
	}
}

/**
 * An argument to include with an OSC package
 */
export interface ServiceOscSender_CompanionOSCArgument {
	type: string
	value: number | string
}

/**
 * A full OSC package when sending a bundle
 */
export interface ServiceOscSender_CompanionOSCBundle {
	address: string
	args: ServiceOscSender_CompanionOSCArgument[]
}
