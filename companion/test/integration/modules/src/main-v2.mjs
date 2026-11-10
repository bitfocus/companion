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

		// The ids the module is subscribed with, reported as variables so tests can see them
		this.trackedActions = new Set()
		this.trackedFeedbacks = new Set()

		const actions = {
			set_var: {
				name: 'Set the test variable',
				options: [{ id: 'value', type: 'textinput', label: 'Value', default: '' }],
				callback: async (action) => {
					this.lastValue = `${this.prefix ?? ''}${action.options.value}`
					this.runCount = (this.runCount ?? 0) + 1
					this.setVariableValues({ last_value: this.lastValue, run_count: this.runCount })
					this.checkFeedbacks('last_value_is', 'track_fb')
				},
			},
			track: {
				name: 'Track (with subscribe and learn callbacks)',
				options: [{ id: 'value', type: 'textinput', label: 'Value', default: '' }],
				callback: async () => {},
				optionsToMonitorForSubscribe: ['value'],
				subscribe: (action) => this.setTracked('tracked_actions', this.trackedActions, action.id, true),
				unsubscribe: (action) => this.setTracked('tracked_actions', this.trackedActions, action.id, false),
				learn: (action) => {
					this.setVariableValues({ learned_id: action.id })
					return { value: this.lastValue ?? '' }
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
			track_fb: {
				type: 'boolean',
				name: 'Track (with subscribe and learn callbacks)',
				defaultStyle: { bgcolor: 0xff0000 },
				options: [{ id: 'value', type: 'textinput', label: 'Value', default: '' }],
				// 2.x feedbacks have no subscribe, the callback is run when one is subscribed
				callback: (feedback) => {
					this.setTracked('tracked_feedbacks', this.trackedFeedbacks, feedback.id, true)
					return this.lastValue === feedback.options.value
				},
				unsubscribe: (feedback) => this.setTracked('tracked_feedbacks', this.trackedFeedbacks, feedback.id, false),
				learn: (feedback) => {
					this.setVariableValues({ learned_feedback_id: feedback.id })
					return { value: this.lastValue ?? '' }
				},
			},
		})

		const variables = {
			last_value: { name: 'Last value' },
			run_count: { name: 'Run count' },
			prefix: { name: 'Configured prefix' },
			node_version: { name: 'Node.js version of the child process' },
			tracked_actions: { name: 'Ids of the subscribed track actions' },
			tracked_feedbacks: { name: 'Ids of the subscribed track feedbacks' },
			learned_id: { name: 'Id of the last action learnt' },
			learned_feedback_id: { name: 'Id of the last feedback learnt' },
		}
		if (has('shared-udp')) {
			variables.udp_listening = { name: 'Shared udp port being listened on' }
			variables.last_udp = { name: 'Last shared-udp datagram received' }
		}
		this.setVariableDefinitions(variables)
		this.setVariableValues({ node_version: process.versions.node })

		await this.configUpdated(config)
	}

	setTracked(variableId, ids, id, subscribed) {
		if (subscribed) ids.add(id)
		else ids.delete(id)
		this.setVariableValues({ [variableId]: [...ids].sort().join(',') })
	}

	async destroy() {
		this.closeUdpSocket()
	}

	closeUdpSocket() {
		const active = this.udp
		if (!active) return
		this.udp = undefined
		// bind() goes through the host and leaves the socket 'binding' until it settles; close() throws
		// 'Socket is not open' in that state, so defer the close until the bind has completed
		if (active.bound) {
			active.socket.close()
		} else {
			active.closeWhenBound = true
		}
	}

	async configUpdated(config, _secrets) {
		this.prefix = config?.prefix ?? ''
		this.setVariableValues({ prefix: this.prefix })

		if (has('shared-udp')) {
			this.closeUdpSocket()
			const udpPort = Number(config?.udp_port)
			if (udpPort > 0) {
				const active = { socket: undefined, bound: false, closeWhenBound: false }
				active.socket = this.createSharedUdpSocket('udp4', (message) => {
					this.setVariableValues({ last_udp: Buffer.from(message).toString() })
				})
				this.udp = active
				active.socket.on('error', (e) => this.log('error', `Shared udp socket error: ${e}`))
				active.socket.bind(udpPort, undefined, () => {
					active.bound = true
					// a close requested while the bind was still in flight was deferred to here
					if (active.closeWhenBound) {
						active.socket.close()
						return
					}
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

// Moves the old `val` option of set_var to `value`, so tests can see upgrade scripts run
function upgradeSetVarVal(_context, props) {
	const updatedActions = []
	for (const action of props.actions) {
		if (action.actionId !== 'set_var' || action.options.val === undefined) continue
		action.options.value = action.options.val
		delete action.options.val
		updatedActions.push(action)
	}
	return { updatedConfig: null, updatedActions, updatedFeedbacks: [] }
}

export default TestInstance
export const UpgradeScripts = [upgradeSetVarVal]
