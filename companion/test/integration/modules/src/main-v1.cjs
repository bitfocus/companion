/*
 * Test connection module for the module-api 1.x contract (the module file is the process
 * entrypoint and calls runEntrypoint itself). Bundled per api version by build-module-fixtures.mts.
 */
const { InstanceBase, InstanceStatus, runEntrypoint } = require('@companion-module/base')

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

		this.setVariableDefinitions([
			{ variableId: 'last_value', name: 'Last value' },
			{ variableId: 'run_count', name: 'Run count' },
			{ variableId: 'prefix', name: 'Configured prefix' },
			{ variableId: 'node_version', name: 'Node.js version of the child process' },
		])
		this.setVariableValues({ node_version: process.versions.node })

		await this.configUpdated(config)
	}

	async destroy() {}

	async configUpdated(config) {
		this.prefix = config?.prefix ?? ''
		this.setVariableValues({ prefix: this.prefix })
	}

	getConfigFields() {
		return [{ id: 'prefix', type: 'textinput', label: 'Prefix', width: 6, default: '' }]
	}
}

runEntrypoint(TestInstance, [])
