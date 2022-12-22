/*
 * This file is part of the Companion project
 * Copyright (c) 2018 Bitfocus AS
 * Authors: William Viker <william@bitfocus.io>, Håkon Nessjøen <haakon@bitfocus.io>
 *
 * This program is free software.
 * You should have received a copy of the MIT licence as well as the Bitfocus
 * Individual Contributor License Agreement for companion along with
 * this program.
 *
 * You can be released from the requirements of the license by purchasing
 * a commercial license. Buying such a license is mandatory as soon as you
 * develop commercial activities involving the Companion software without
 * disclosing the source code of your own applications.
 *
 */

import CoreBase from '../Core/Base.js'
import os from 'os'
import { exec } from 'child_process'
import { isEqual } from 'lodash-es'

function getNetworkInterfacesVariables() {
	// TODO - review/refactor this

	const definitions = []
	const values = {}
	let allIps = ''

	try {
		const networkInterfaces = os.networkInterfaces()
		for (const iface in networkInterfaces) {
			const v4Addresses = []
			for (const address of networkInterfaces[iface]) {
				if (address?.family === 'IPv4') {
					v4Addresses.push(address.address)
				}
			}

			const numV4s = v4Addresses.length
			for (let i = 0; i < numV4s; i++) {
				const aNum = numV4s > 1 ? `:${i}` : ''
				const name = `${iface.split(' ')[0]}${aNum}`

				definitions.push({
					label: `${iface}${aNum} IP Address`,
					name: name,
				})
				values[name] = v4Addresses[i]
				allIps += v4Addresses[i] + '\\n'
			}
		}
	} catch (e) {
		// TODO
	}

	values['all_ip'] = allIps.trim()

	return { definitions, values }
}

export default class System extends CoreBase {
	#interfacesDefinitions = []
	#interfacesValues = {}

	constructor(registry, internalModule) {
		super(registry, 'internal', 'Internal/System')

		// this.internalModule = internalModule

		// TODO - reactive:
		// self.system.emit('config_get', 'bind_ip', function (bind_ip) {
		// 	self.setVariable('bind_ip', bind_ip)
		// })

		// Update interfaces on an interval, but also soon after launch
		setInterval(() => this.#updateNetworkInterfaces(), 30000)
		setTimeout(() => this.#updateNetworkInterfaces(), 5000)
	}

	#updateNetworkInterfaces() {
		const info = getNetworkInterfacesVariables()

		if (!isEqual(info.definitions, this.#interfacesDefinitions)) {
			this.#interfacesDefinitions = info.definitions
			this.internalModule.regenerateVariables()
		}

		if (!isEqual(info.values, this.#interfacesValues)) {
			this.#interfacesValues = info.values
			this.internalModule.setVariables(info.values)
		}
	}

	getVariableDefinitions() {
		return [
			{
				label: 'IP of admin network interface',
				name: 'bind_ip',
			},
			{
				label: 'IP of all network interfaces',
				name: 'all_ip',
			},
		]
	}

	getActionDefinitions() {
		const actions = {
			exec: {
				label: 'Run shell path (local)',
				options: [
					{
						type: 'textinput',
						label: 'Path (supports variables in path)',
						id: 'path',
					},
					{
						type: 'number',
						label: 'Timeout (ms, between 500 and 20000)',
						id: 'timeout',
						default: 5000,
						min: 500,
						max: 20000,
					},
				],
			},

			app_exit: {
				label: 'Kill companion',
				options: [],
			},
		}

		if (process.env.COMPANION_IPC_PARENT) {
			// Only offer app_restart if there is a handler for the event
			actions['app_restart'] = {
				label: 'Restart companion',
				options: [],
			}
		}

		return actions
	}

	executeAction(action) {
		if (action.action === 'exec') {
			if (action.options.path) {
				const path = this.instance.variable.parseVariables(action.options.path).text
				this.logger.silly(`Running path: '${path}'`)

				exec(
					path,
					{
						timeout: action.options.timeout ?? 5000,
					},
					(error, stdout, stderr) => {
						if (error) {
							this.logger.error('Shell command failed. Guru meditation: ' + JSON.stringify(error))
							this.logger.silly(error)
						}
					}
				)
			}
			return true
		} else if (action.action === 'app_exit') {
			this.registry.exit(true, false)
			return true
		} else if (action.action === 'app_restart') {
			this.registry.exit(true, true)
			return true
		}
	}
}
