/*
 * Test connection module for the module-api 1.x contract (the module file is the process
 * entrypoint and calls runEntrypoint itself). Bundled per api version by build-module-fixtures.mts.
 *
 * Definitions for behaviours that appeared mid-1.x are registered behind hasApiFeature() gates,
 * driven by the api version this bundle is built against - see module-api-features.json.
 */
const { InstanceBase, InstanceStatus, runEntrypoint } = require('@companion-module/base')
const { hasApiFeature } = require('./api-gates.ts')

// Injected by build-module-fixtures.mts: the base library version this bundle is built against
const API_VERSION = process.env.FIXTURE_API_VERSION
const has = (featureId) => hasApiFeature(API_VERSION, featureId)

class TestInstance extends InstanceBase {
	async init(config) {
		this.updateStatus(InstanceStatus.Ok)

		this.setActionDefinitions({
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
		})

		this.setFeedbackDefinitions({
			last_value_is: {
				type: 'boolean',
				name: 'Last value is',
				defaultStyle: { bgcolor: 0xff0000 },
				options: [{ id: 'value', type: 'textinput', label: 'Value', default: '' }],
				callback: (feedback) => this.lastValue === feedback.options.value,
			},
		})

		const variables = [
			{ variableId: 'last_value', name: 'Last value' },
			{ variableId: 'run_count', name: 'Run count' },
			{ variableId: 'prefix', name: 'Configured prefix' },
			{ variableId: 'node_version', name: 'Node.js version of the child process' },
		]
		if (has('shared-udp')) {
			variables.push(
				{ variableId: 'udp_listening', name: 'Shared udp port being listened on' },
				{ variableId: 'last_udp', name: 'Last shared-udp datagram received' }
			)
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

	async configUpdated(config) {
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

runEntrypoint(TestInstance, [])
