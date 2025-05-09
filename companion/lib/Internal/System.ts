/*
 * This file is part of the Companion project
 * Copyright (c) 2018 Bitfocus AS
 * Authors: William Viker <william@bitfocus.io>, Håkon Nessjøen <haakon@bitfocus.io>
 *
 * This program is free software.
 * You should have received a copy of the MIT licence as well as the Bitfocus
 * Individual Contributor License Agreement for companion along with
 * this program.
 */

import os from 'os'
import { exec } from 'child_process'
import { isEqual } from 'lodash-es'
import LogController from '../Log/Controller.js'
import systeminformation from 'systeminformation'
import type { CompanionVariableValues } from '@companion-module/base'
import type { RunActionExtras, VariableDefinitionTmp } from '../Instance/Wrapper.js'
import type {
	ActionForVisitor,
	FeedbackForVisitor,
	InternalActionDefinition,
	InternalModuleFragment,
	InternalModuleFragmentEvents,
	InternalVisitor,
} from './Types.js'
import type { VariablesController } from '../Variables/Controller.js'
import type { ControlEntityInstance } from '../Controls/Entities/EntityInstance.js'
import { promisify } from 'util'
import type { InternalModuleUtils } from './Util.js'
import { EventEmitter } from 'events'

const execAsync = promisify(exec)

async function getHostnameVariables() {
	const values: CompanionVariableValues = {}

	try {
		values['hostname'] = os.hostname()

		const systemInfo = await systeminformation.osInfo()
		values['hostname_fqdn'] = systemInfo.fqdn
	} catch (e) {
		// TODO
	}

	return values
}

async function getNetworkVariables() {
	// TODO - review/refactor this

	const definitions: VariableDefinitionTmp[] = []
	const values: CompanionVariableValues = {}
	let allIps = ''

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

export class InternalSystem extends EventEmitter<InternalModuleFragmentEvents> implements InternalModuleFragment {
	readonly #logger = LogController.createLogger('Internal/System')
	readonly #customMessageLogger = LogController.createLogger('Custom')

	readonly #internalUtils: InternalModuleUtils
	readonly #variableController: VariablesController
	readonly #requestExit: (fromInternal: boolean, restart: boolean) => void

	#interfacesDefinitions: VariableDefinitionTmp[] = []
	#interfacesValues: CompanionVariableValues = {}

	constructor(
		internalUtils: InternalModuleUtils,
		variableController: VariablesController,
		requestExit: (fromInternal: boolean, restart: boolean) => void
	) {
		super()

		this.#internalUtils = internalUtils
		this.#variableController = variableController
		this.#requestExit = requestExit

		// Update interfaces on an interval, but also soon after launch
		setInterval(() => this.#updateNetworkVariables(), 30000)
		setTimeout(() => this.#updateNetworkVariables(), 5000)

		setTimeout(
			() =>
				this.#updateHostnameVariablesAtStartup().catch((e) => {
					this.#logger.error(`Failed to update hostname variables: ${e}`)
				}),
			5000
		)
	}

	async #updateHostnameVariablesAtStartup() {
		let latestVariables = await getHostnameVariables()
		this.emit('setVariables', latestVariables)

		const updateVariables = () => {
			getHostnameVariables()
				.then((newVariables) => {
					if (Object.keys(newVariables).length > 1 && !isEqual(newVariables, latestVariables)) {
						latestVariables = newVariables
						this.emit('setVariables', newVariables)
					}
				})
				.catch((e) => {
					this.#logger.error(`Failed to update hostname variables: ${e}`)
				})
		}

		// Run a couple more times just in case one failed
		setTimeout(() => updateVariables(), 30000)
		setTimeout(() => updateVariables(), 60000)
	}

	#updateNetworkVariablesRunning = false
	#updateNetworkVariables() {
		if (this.#updateNetworkVariablesRunning) return
		this.#updateNetworkVariablesRunning = true

		getNetworkVariables()
			.then((info) => {
				if (!isEqual(info.definitions, this.#interfacesDefinitions)) {
					this.#interfacesDefinitions = info.definitions
					this.emit('regenerateVariables')
				}

				if (!isEqual(info.values, this.#interfacesValues)) {
					this.#interfacesValues = info.values
					this.emit('setVariables', info.values)
				}
			})
			.catch((e) => {
				this.#logger.error(`Failed to update network and hostname variables: ${e}`)
			})
			.finally(() => {
				this.#updateNetworkVariablesRunning = false
			})
	}

	/**
	 * Update the bind IP address variable
	 * @param bindIp The IP address being bound to
	 */
	updateBindIp(bindIp: string) {
		this.emit('setVariables', {
			bind_ip: bindIp,
		})
	}

	getVariableDefinitions(): VariableDefinitionTmp[] {
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

	getActionDefinitions(): Record<string, InternalActionDefinition> {
		const actions: Record<string, InternalActionDefinition> = {
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
			custom_log: {
				label: 'Write to companion log',
				description: undefined,
				options: [
					{
						type: 'textinput',
						label: 'Message',
						id: 'message',
						useVariables: {
							local: true,
						},
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

	async executeAction(action: ControlEntityInstance, extras: RunActionExtras): Promise<boolean> {
		if (action.definitionId === 'exec') {
			if (action.rawOptions.path) {
				const path = this.#internalUtils.parseVariablesForInternalActionOrFeedback(action.rawOptions.path, extras).text
				this.#logger.silly(`Running path: '${path}'`)

				try {
					const { stdout } = await execAsync(path, {
						timeout: action.rawOptions.timeout ?? 5000,
					})

					// Trim EOL character(s) appended by the OS
					let stdoutStr = stdout.toString()
					if (stdoutStr.endsWith(os.EOL)) stdoutStr = stdoutStr.substring(0, stdoutStr.length - os.EOL.length)

					if (action.rawOptions.targetVariable) {
						this.#variableController.custom.setValue(action.rawOptions.targetVariable, stdoutStr)
					}
				} catch (error) {
					this.#logger.error('Shell command failed. Guru meditation: ' + JSON.stringify(error))
					this.#logger.silly(error)
				}
			}
			return true
		} else if (action.definitionId === 'custom_log') {
			const message = this.#internalUtils.parseVariablesForInternalActionOrFeedback(
				action.rawOptions.message,
				extras
			).text
			this.#customMessageLogger.info(message)

			return true
		} else if (action.definitionId === 'app_restart') {
			this.#requestExit(true, true)
			return true
		} else if (action.definitionId === 'app_exit') {
			this.#requestExit(true, false)
			return true
		} else {
			return false
		}
	}

	visitReferences(_visitor: InternalVisitor, _actions: ActionForVisitor[], _feedbacks: FeedbackForVisitor[]): void {
		// Nothing to do
	}
}
