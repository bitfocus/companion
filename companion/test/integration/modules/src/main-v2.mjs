/*
 * Test connection module for the module-api 2.x contract (companion's ConnectionThread imports the
 * module and expects a default-exported class). Bundled per api version by build-module-fixtures.mts.
 *
 * Definitions for behaviours that appeared in a specific api version are registered behind
 * hasApiFeature() gates, driven by the version this bundle is built against - see
 * module-api-features.json.
 */
import { InstanceBase, InstanceStatus } from '@companion-module/base'
import { hasApiFeature } from './api-gates.ts'

// Injected by build-module-fixtures.mts: the base library version this bundle is built against
const API_VERSION = process.env.FIXTURE_API_VERSION
const has = (featureId) => hasApiFeature(API_VERSION, featureId)

class TestInstance extends InstanceBase {
	async init(config, _isFirstInit, _secrets) {
		this.updateStatus(InstanceStatus.Ok)

		const actions = {
			set_var: {
				name: 'Set the test variable',
				options: [{ id: 'value', type: 'textinput', label: 'Value', default: '' }],
				callback: async (action) => {
					this.lastValue = `${this.prefix ?? ''}${action.options.value}`
					this.runCount = (this.runCount ?? 0) + 1
					this.setVariableValues({ last_value: this.lastValue, run_count: this.runCount })
					this.checkFeedbacks('last_value_is')
				},
			},
		}
		if (has('action-result-value')) {
			actions.get_prefixed_value = {
				name: 'Get the prefixed value (returns a result)',
				options: [{ id: 'value', type: 'textinput', label: 'Value', default: '' }],
				hasResult: true,
				callback: async (action) => `${this.prefix ?? ''}${action.options.value}`,
			}
		}
		this.setActionDefinitions(actions)

		this.setFeedbackDefinitions({
			last_value_is: {
				type: 'boolean',
				name: 'Last value is',
				defaultStyle: { bgcolor: 0xff0000 },
				options: [{ id: 'value', type: 'textinput', label: 'Value', default: '' }],
				callback: (feedback) => this.lastValue === feedback.options.value,
			},
		})

		const variables = {
			last_value: { name: 'Last value' },
			run_count: { name: 'Run count' },
			prefix: { name: 'Configured prefix' },
			node_version: { name: 'Node.js version of the child process' },
		}
		if (has('shared-udp')) {
			variables.udp_listening = { name: 'Shared udp port being listened on' }
			variables.last_udp = { name: 'Last shared-udp datagram received' }
		}
		this.setVariableDefinitions(variables)
		this.setVariableValues({ node_version: process.versions.node })

		await this.configUpdated(config)
	}

	async destroy() {
		this.closeUdpSocket()
	}

	closeUdpSocket() {
		if (this.udpSocket) {
			this.udpSocket.close()
			this.udpSocket = undefined
		}
	}

	async configUpdated(config, _secrets) {
		this.prefix = config?.prefix ?? ''
		this.setVariableValues({ prefix: this.prefix })

		if (has('shared-udp')) {
			this.closeUdpSocket()
			const udpPort = Number(config?.udp_port)
			if (udpPort > 0) {
				this.udpSocket = this.createSharedUdpSocket('udp4', (message) => {
					this.setVariableValues({ last_udp: Buffer.from(message).toString() })
				})
				this.udpSocket.on('error', (e) => this.log('error', `Shared udp socket error: ${e}`))
				this.udpSocket.bind(udpPort, undefined, () => {
					this.setVariableValues({ udp_listening: String(udpPort) })
				})
			}
		}
	}

	getConfigFields() {
		return [
			{ id: 'prefix', type: 'textinput', label: 'Prefix', width: 6, default: '' },
			{ id: 'udp_port', type: 'number', label: 'Shared udp port (0 = off)', width: 6, default: 0, min: 0, max: 65535 },
		]
	}
}

export default TestInstance
export const UpgradeScripts = []
