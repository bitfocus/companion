import TriggersPluginBase from './Base.js'

class TriggersPluginInstance extends TriggersPluginBase {
	setup() {
		this.options = [
			{
				key: 'run',
				name: 'Run at',
				type: 'select',
				choices: [
					{
						id: 'start',
						label: 'Startup',
					},
					{
						id: 'io_connect',
						label: 'Webpage Load',
					},
					{
						id: 'button_press',
						label: 'On any button press',
					},
					{
						id: 'button_depress',
						label: 'On any button depress',
					},
				],
			},
		]
	}

	onBankPress(bank, button, press_status, deviceid) {
		// If the scheduler is recalling this button, don't start an infinite loop...
		if (!deviceid || deviceid !== 'scheduler') {
			this._run(press_status ? 'button_press' : 'button_depress')
		}
	}

	/**
	 * Indicate the system is ready for processing
	 * @access public
	 */
	onSystemReady() {
		setTimeout(() => {
			this._run('start')
		}, 10000)
	}

	config_desc(config) {
		const run_conf = this.options[0].choices.find((x) => x.id === config.run)
		let run_time = !run_conf ? 'unknown' : run_conf.label

		return run_time
	}
}

export default TriggersPluginInstance
