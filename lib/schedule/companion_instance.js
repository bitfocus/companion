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

const common = require('./common');

class companion_instance extends common {

	setup() {
		const system = this.scheduler.system;

		system.on('modules_loaded', () => {
			// Wait to run since some modules need time to connect
			setTimeout(this._run.bind(this, 'start'), 10000);
		});

		system.on('io_connect', this._run.bind(this, 'io_connect'));
		system.on('bank_pressed', (bank, button, press_status, deviceid) => {
			// If the scheduler is recalling this button, don't start an infinite loop...
			if (!deviceid || deviceid !== 'scheduler') {
				this._run(press_status ? 'button_press' : 'button_depress')
			}
		});

		this.options = [
			{
				key: 'run',
				name: 'Run at',
				type: 'select',
				choices: [
					{
						id: 'start',
						label: 'Startup'
					},
					{
						id: 'io_connect',
						label: 'Webpage Load'
					},
					{
						id: 'button_press',
						label: 'On any button press'
					},
					{
						id: 'button_depress',
						label: 'On any button depress'
					}
				]
			}
		];
	}

	config_desc(config) {
		const run_conf = this.options[0].choices.find(x => x.id === config.run);
		let run_time = !run_conf ? 'unknown' : run_conf.label;

		return run_time;
	}

	get name() {
		return 'Instance';
	}

	get type() {
		return 'instance';
	}

	/**
	 * Checks if event needs to run
	 * @param {string} run Name of run type based on the option choices (ie, start or button_press)
	 */
	_run(run) {
		this.watch.filter(x => x.config.run === run)
			.forEach(x => this.scheduler.action(x.id));
	}
}

module.exports = companion_instance;
