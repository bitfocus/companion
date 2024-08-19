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

import os from 'os'
import { exec } from 'child_process'
import { isEqual } from 'lodash-es'
import LogController from '../Log/Controller.js'
import systeminformation from 'systeminformation'

async function getNetworkAndHostnameVariables() {
	// TODO - review/refactor this

	/** @type {import('../Instance/Wrapper.js').VariableDefinitionTmp[]} */
	const definitions = []
	/** @type { import('@companion-module/base').CompanionVariableValues} */
	const values = {}
	let allIps = ''

	try {
		values['hostname'] = os.hostname()

		const systemInfo = await systeminformation.osInfo()
		values['hostname_fqdn'] = systemInfo.fqdn
	} catch (e) {
		// TODO
	}

	try {
		const networkInterfaces = os.networkInterfaces()
		for (const iface in networkInterfaces) {
			const v4Addresses = []
			for (const address of networkInterfaces[iface] ?? []) {
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

export default class System {
	#logger = LogController.createLogger('Internal/System')

	/**
	 * @type {import('../Registry.js').default}
	 * @readonly
	 */
	#registry

	/**
	 * @type {import('./Controller.js').default}
	 * @readonly
	 */
	#internalModule

	/**
	 * @type {import('../Variables/Controller.js').VariablesController}
	 * @readonly
	 */
	#variableController

	/** @type {import('../Instance/Wrapper.js').VariableDefinitionTmp[]} */
	#interfacesDefinitions = []
	/** @type {import('@companion-module/base').CompanionVariableValues} */
	#interfacesValues = {}

	/**
	 * @param {import('./Controller.js').default} internalModule
	 * @param {import('../Registry.js').default} registry
	 */
	constructor(internalModule, registry) {
		this.#internalModule = internalModule
		this.#registry = registry
		this.#variableController = registry.variables

		// TODO - reactive:
		// self.system.emit('config_get', 'bind_ip', function (bind_ip) {
		// 	self.setVariable('bind_ip', bind_ip)
		// })

		// Update interfaces on an interval, but also soon after launch
		setInterval(() => this.#updateNetworkAndHostnameVariables(), 30000)
		setTimeout(() => this.#updateNetworkAndHostnameVariables(), 5000)
	}

	#updateNetworkAndHostnameVariablesRunning = false
	#updateNetworkAndHostnameVariables() {
		if (this.#updateNetworkAndHostnameVariablesRunning) return
		this.#updateNetworkAndHostnameVariablesRunning = true

		getNetworkAndHostnameVariables()
			.then((info) => {
				if (!isEqual(info.definitions, this.#interfacesDefinitions)) {
					this.#interfacesDefinitions = info.definitions
					this.#internalModule.regenerateVariables()
				}

				if (!isEqual(info.values, this.#interfacesValues)) {
					this.#interfacesValues = info.values
					this.#internalModule.setVariables(info.values)
				}
			})
			.catch((e) => {
				this.#logger.error(`Failed to update network and hostname variables: ${e}`)
			})
			.finally(() => {
				this.#updateNetworkAndHostnameVariablesRunning = false
			})
	}

	/**
	 * @returns {import('../Instance/Wrapper.js').VariableDefinitionTmp[]}
	 */
	getVariableDefinitions() {
		return [
			{
				label: 'System: Hostname',
				name: 'hostname',
			},
			{
				label: 'System: Hostname (FQDN)',
				name: 'hostname_fqdn',
			},
			{
				label: 'System: IP of admin network interface',
				name: 'bind_ip',
			},
			{
				label: 'System: IP of all network interfaces',
				name: 'all_ip',
			},
			...this.#interfacesDefinitions,
		]
	}

	/**
	 * @returns {Record<string, import('./Types.js').InternalActionDefinition>}
	 */
	getActionDefinitions() {
		/** @type {Record<string, import('./Types.js').InternalActionDefinition>} */
		const actions = {
			exec: {
				label: 'System: Run shell path (local)',
				description: undefined,
				options: [
					{
						type: 'textinput',
						label: 'Path (supports variables in path)',
						id: 'path',
						useVariables: {
							local: true,
						},
					},
					{
						type: 'number',
						label: 'Timeout (ms, between 500 and 20000)',
						id: 'timeout',
						default: 5000,
						min: 500,
						max: 20000,
					},
					{
						type: 'internal:custom_variable',
						label: 'Target Variable (stdout)',
						id: 'targetVariable',
						includeNone: true,
					},
				],
			},
		}

		if (process.env.COMPANION_IPC_PARENT || process.env.COMPANION_IN_SYSTEMD) {
			// Only offer app_restart if there is a handler for the event
			actions['app_restart'] = {
				label: 'System: Restart companion',
				description: undefined,
				options: [],
			}
		}
		if (process.env.COMPANION_IPC_PARENT) {
			// Only offer app_exit if there is a handler for the event
			actions['app_exit'] = {
				label: 'System: Exit companion',
				description: undefined,
				options: [],
			}
		}

		return actions
	}

	/**
	 * Run a single internal action
	 * @param {import('@companion-app/shared/Model/ActionModel.js').ActionInstance} action
	 * @param {import('../Instance/Wrapper.js').RunActionExtras} extras
	 * @returns {boolean} Whether the action was handled
	 */
	executeAction(action, extras) {
		if (action.action === 'exec') {
			if (action.options.path) {
				const path = this.#variableController.values.parseVariables(action.options.path, extras.location).text
				this.#logger.silly(`Running path: '${path}'`)

				exec(
					path,
					{
						timeout: action.options.timeout ?? 5000,
					},
					(error, stdout, _stderr) => {
						if (error) {
							this.#logger.error('Shell command failed. Guru meditation: ' + JSON.stringify(error))
							this.#logger.silly(error)
						}

						// Trim EOL character(s) appended by the OS
						if (typeof stdout === 'string' && stdout.endsWith(os.EOL))
							stdout = stdout.substring(0, stdout.length - os.EOL.length)

						if (action.options.targetVariable) {
							this.#variableController.custom.setValue(action.options.targetVariable, stdout)
						}
					}
				)
			}
			return true
		} else if (action.action === 'app_restart') {
			this.#registry.exit(true, true)
			return true
		} else if (action.action === 'app_exit') {
			this.#registry.exit(true, false)
			return true
		} else {
			return false
		}
	}
}
