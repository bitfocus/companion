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
import isEqual from 'fast-deep-equal'
import LogController from '../Log/Controller.js'
import systeminformation from 'systeminformation'
import type { RunActionExtras } from '../Instance/Connection/ChildHandlerApi.js'
import type {
	ActionForInternalExecution,
	ActionForVisitor,
	FeedbackForVisitor,
	InternalActionDefinition,
	InternalModuleFragment,
	InternalModuleFragmentEvents,
	InternalVisitor,
} from './Types.js'
import type { VariablesController } from '../Variables/Controller.js'
import { promisify } from 'util'
import { EventEmitter } from 'events'
import type { DataUserConfig } from '../Data/UserConfig.js'
import debounceFn from 'debounce-fn'
import type { AppInfo } from '../Registry.js'
import {
	stringifyVariableValue,
	type VariableDefinition,
	type VariableValues,
} from '@companion-app/shared/Model/Variables.js'

const execAsync = promisify(exec)

async function getHostnameVariables() {
	const values: VariableValues = {}

	try {
		values['hostname'] = os.hostname()

		const systemInfo = await systeminformation.osInfo()
		values['hostname_fqdn'] = systemInfo.fqdn
	} catch (_e) {
		// TODO
	}

	return values
}

async function getNetworkVariables() {
	// TODO - review/refactor this

	const definitions: VariableDefinition[] = []
	const values: VariableValues = {}
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
					description: `${iface}${aNum} IP Address`,
					name: name,
				})
				values[name] = v4Addresses[i]
				allIps += v4Addresses[i] + '\\n'
			}
		}
	} catch (_e) {
		// TODO
	}

	values['all_ip'] = allIps.trim()

	return { definitions, values }
}

export class InternalSystem extends EventEmitter<InternalModuleFragmentEvents> implements InternalModuleFragment {
	readonly #logger = LogController.createLogger('Internal/System')
	readonly #customMessageLogger = LogController.createLogger('Custom')

	readonly #appInfo: AppInfo
	readonly #variableController: VariablesController
	readonly #userConfigController: DataUserConfig
	readonly #requestExit: (fromInternal: boolean, restart: boolean) => void

	#interfacesDefinitions: VariableDefinition[] = []
	#interfacesValues: VariableValues = {}

	constructor(
		appInfo: AppInfo,
		userConfigController: DataUserConfig,
		variableController: VariablesController,
		requestExit: (fromInternal: boolean, restart: boolean) => void
	) {
		super()

		this.#appInfo = appInfo
		this.#userConfigController = userConfigController
		this.#variableController = variableController
		this.#requestExit = requestExit

		// Update interfaces on an interval, but also soon after launch
		setInterval(() => this.#updateNetworkVariables(), 30000)
		setTimeout(() => this.#updateNetworkVariables(), 5000)

		setTimeout(() => {
			this.#updateHostnameVariablesAtStartup().catch((e) => {
				this.#logger.error(`Failed to update hostname variables: ${e}`)
			})
		}, 5000)

		const debounceUpdateUserConfigVariables = debounceFn(
			() => {
				const values: VariableValues = {
					installation_name: this.#userConfigController.getKey('installName'),
				}

				this.emit('setVariables', values)
			},
			{
				maxWait: 100,
				wait: 20,
				after: true,
			}
		)

		debounceUpdateUserConfigVariables()
		this.#userConfigController.on('keyChanged', debounceUpdateUserConfigVariables)

		setImmediate(() => {
			this.emit('setVariables', {
				version: this.#appInfo.appVersion,
				version_full: this.#appInfo.appBuild,
			})
		})
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
	updateBindIp(bindIp: string, bindPort?: number): void {
		if (typeof bindPort === 'number') {
			this.emit('setVariables', {
				bind_ip: bindIp,
				bind_port: bindPort,
			})
		} else {
			this.emit('setVariables', {
				bind_ip: bindIp,
			})
		}
	}

	getVariableDefinitions(): VariableDefinition[] {
		return [
			{
				description: 'System: Installation Name',
				name: 'installation_name',
			},
			{
				description: 'System: Hostname',
				name: 'hostname',
			},
			{
				description: 'System: Hostname (FQDN)',
				name: 'hostname_fqdn',
			},
			{
				description: 'System: IP of admin network interface',
				name: 'bind_ip',
			},
			{
				description: 'System: Port of admin network interface',
				name: 'bind_port',
			},
			{
				description: 'System: IP of all network interfaces',
				name: 'all_ip',
			},
			{
				description: 'System: Version',
				name: 'version',
			},
			{
				description: 'System: Version (Full)',
				name: 'version_full',
			},
			...this.#interfacesDefinitions,
		]
	}

	getActionDefinitions(): Record<string, InternalActionDefinition> {
		const actions: Record<string, InternalActionDefinition> = {
			exec: {
				label: 'System: Run shell command (local)',
				description: undefined,
				options: [
					{
						type: 'textinput',
						label: 'Command',
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
						expressionDescription:
							'The name of the custom variable. Just the portion after the "custom:" prefix. Make sure to wrap it in quotes!',
					},
				],
				optionsSupportExpressions: true,
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

				optionsSupportExpressions: true,
			},
		}

		if (process.env.COMPANION_IPC_PARENT || process.env.COMPANION_IN_SYSTEMD) {
			// Only offer app_restart if there is a handler for the event
			actions['app_restart'] = {
				label: 'System: Restart companion',
				description: undefined,
				options: [],
				optionsSupportExpressions: true,
			}
		}
		if (process.env.COMPANION_IPC_PARENT) {
			// Only offer app_exit if there is a handler for the event
			actions['app_exit'] = {
				label: 'System: Exit companion',
				description: undefined,
				options: [],
				optionsSupportExpressions: true,
			}
		}

		return actions
	}

	async executeAction(action: ActionForInternalExecution, _extras: RunActionExtras): Promise<boolean> {
		if (action.definitionId === 'exec') {
			if (action.options.path) {
				const command = stringifyVariableValue(action.options.path)
				this.#logger.silly(`Running command: '${command}'`)

				if (!command || command.trim() === '') {
					this.#logger.warn('No command specified')
					return true
				}

				try {
					const { stdout } = await execAsync(command, {
						timeout: Number(action.options.timeout) || 5000,
					})

					// Trim EOL character(s) appended by the OS
					let stdoutStr = stdout.toString()
					if (stdoutStr.endsWith(os.EOL)) stdoutStr = stdoutStr.substring(0, stdoutStr.length - os.EOL.length)

					const targetVarName = stringifyVariableValue(action.options.targetVariable)
					if (targetVarName) {
						this.#variableController.custom.setValue(targetVarName, stdoutStr)
					}
				} catch (error) {
					this.#logger.error('Shell command failed. Guru meditation: ' + JSON.stringify(error))
					this.#logger.silly(error)
				}
			}
			return true
		} else if (action.definitionId === 'custom_log') {
			const message = stringifyVariableValue(action.options.message)
			this.#customMessageLogger.info(message ?? '')

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

	visitReferences(visitor: InternalVisitor, actions: ActionForVisitor[], _feedbacks: FeedbackForVisitor[]): void {
		for (const action of actions) {
			try {
				if (action.action === 'exec') {
					visitor.visitVariableName(action.options, 'targetVariable')
				}
			} catch (_e) {
				//Ignore
			}
		}
	}
}
