const plugin_base = require('./plugin_base')

class companion_instance extends plugin_base {
	setup() {
		const system = this.scheduler.system

		system.on('modules_loaded', () => {
			// Wait to run since some modules need time to connect
			setTimeout(this._run.bind(this, 'start'), 10000)
		})

		system.on('io_connect', this._run.bind(this, 'io_connect'))
		system.on('bank_pressed', (bank, button, press_status, deviceid) => {
			// If the scheduler is recalling this button, don't start an infinite loop...
			if (!deviceid || deviceid !== 'scheduler') {
				this._run(press_status ? 'button_press' : 'button_depress')
			}
		})

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

	/**
	 * Checks if event needs to run
	 * @param {string} run Name of run type based on the option choices (ie, start or button_press)
	 */
	_run(run) {
		this.watch.filter((x) => x.config.run === run).forEach((x) => this.scheduler.action(x.id))
	}

	get type() {
		return 'instance'
	}

	get name() {
		return 'Instance'
	}

	config_desc(config) {
		const run_conf = this.options[0].choices.find((x) => x.id === config.run)
		let run_time = !run_conf ? 'unknown' : run_conf.label

		return run_time
	}
}

module.exports = companion_instance
