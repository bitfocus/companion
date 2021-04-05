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

class SchedulePluginInterval extends SchedulePluginBase {
	setup() {
		this.options = [
			{
				key: 'seconds',
				name: 'Run every',
				type: 'textinput',
				placeholder: 'Time, in seconds, to run event',
				pattern: '([0-9]*)',
			},
		]
	}

	add(id, data) {
		const data2 = {
			...data,
			interval: setInterval(() => {
				this.controller.action(id)
			}, parseInt(data.config.seconds) * 1000),
		}

		super.add(id, data2)
	}

	configDesc(config) {
		let time

		if (config.seconds >= 3600) {
			time = `${parseInt(config.seconds / 3600)} hours`
		} else if (config.seconds >= 60) {
			time = `${parseInt(config.seconds / 60)} minutes`
		} else {
			time = `${config.seconds} seconds`
		}

		return `Runs every <strong>${time}</strong>.`
	}

	get name() {
		return 'Time interval'
	}

	get type() {
		return 'interval'
	}

	/**
	 * Checks if event should work
	 * @param {number} day
	 * @param {string} hms
	 */
	matches(day, hms) {
		this.watch
			.filter((x) => x.config.days.includes(day) && x.config.time === hms)
			.forEach((x) => this.controller.action(x.id))
	}

	remove(id) {
		const config = this.watch.find((x) => x.id == id)

		if (config && config.interval) {
			clearInterval(config.interval)
		}

		super.remove(id)
	}
}

module.exports = SchedulePluginInterval
