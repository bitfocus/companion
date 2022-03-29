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

	/**
	 * Setup a new socket client's events
	 * @param {SocketIO} client - the client socket
	 * @access public
	 */
	clientConnect(client) {
		this._run('io_connect')
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

export default TriggersPluginInstance
