/*
 * This file is part of the Companion project
 * Copyright (c) 2018 Bitfocus AS
 * Authors: William Viker <william@bitfocus.io>, Håkon Nessjøen <haakon@bitfocus.io>
 *
 * This program is free software.
 * You should have received a copy of the MIT licence as well as the Bitfocus
 * Individual Contributor License Agreement for companion along with
 * this program.
 *
 * You can be released from the requirements of the license by purchasing
 * a commercial license. Buying such a license is mandatory as soon as you
 * develop commercial activities involving the Companion software without
 * disclosing the source code of your own applications.
 *
 */

const SchedulePluginBase = require('./Base')

class SchedulePluginInstance extends SchedulePluginBase {
	setup() {
		this.system.on('modules_loaded', () => {
			// Wait to run since some modules need time to connect
			setTimeout(this.run.bind(this, 'start'), 10000)
		})

		this.system.on('io_connect', this.run.bind(this, 'io_connect'))
		this.system.on('bank_pressed', (bank, button, pressStatus, deviceid) => {
			// If the scheduler is recalling this button, don't start an infinite loop...
			if (!deviceid || deviceid !== 'scheduler') {
				this.run(pressStatus ? 'button_press' : 'button_depress')
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

	configDesc(config) {
		const runConf = this.options[0].choices.find((x) => x.id === config.run)
		let runTime = !runConf ? 'unknown' : runConf.label

		return runTime
	}

	get name() {
		return 'Instance'
	}

	get type() {
		return 'instance'
	}

	/**
	 * Checks if event needs to run
	 * @param {string} run Name of run type based on the option choices (ie, start or button_press)
	 * @access protected
	 */
	run(run) {
		this.watch.filter((x) => x.config.run === run).forEach((x) => this.controller.action(x.id))
	}
}

module.exports = SchedulePluginInstance
