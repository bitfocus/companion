/*
 * Test connection module for the module-api 2.x contract (companion's ConnectionThread imports the
 * module and expects a default-exported class). Bundled per api version by build-module-fixtures.mts.
 */
import { InstanceBase, InstanceStatus } from '@companion-module/base'

class TestInstance extends InstanceBase {
	async init(config, _isFirstInit, _secrets) {
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

		this.setVariableDefinitions({
			last_value: { name: 'Last value' },
			run_count: { name: 'Run count' },
			prefix: { name: 'Configured prefix' },
		})

		await this.configUpdated(config)
	}

	async destroy() {}

	async configUpdated(config, _secrets) {
		this.prefix = config?.prefix ?? ''
		this.setVariableValues({ prefix: this.prefix })
	}

	getConfigFields() {
		return [{ id: 'prefix', type: 'textinput', label: 'Prefix', width: 6, default: '' }]
	}
}

export default TestInstance
export const UpgradeScripts = []
