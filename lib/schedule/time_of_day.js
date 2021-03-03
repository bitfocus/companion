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

const common = require('./common')
const moment = require('moment')

class time_of_day extends common {
	setup() {
		this.day_format = 'ddd'

		this.interval_watch = setInterval(() => {
			const now = new Date()
			const hms =
				now.getHours().toString().padStart(2, '0') +
				':' +
				now.getMinutes().toString().padStart(2, '0') +
				':' +
				now.getSeconds().toString().padStart(2, '0')
			this.matches(now.getDay().toString(), hms)
		}, 1000)

		this.options = [
			{
				key: 'time',
				name: 'Time',
				type: 'textinput',
				placeholder: 'Time in format HH:MM:SS',
				pattern: '(0[0-9]|1[0-9]|2[0-3])(:[0-5][0-9]){2}',
			},
			{
				key: 'days',
				name: 'Days',
				type: 'select',
				multi: true,
				choices: this._day_list(),
			},
		]
	}

	config_desc(config) {
		const days = config.days
		let day_str = days.toString()

		if (days.length === 7) {
			day_str = 'Daily'
		} else if (day_str === '1,2,3,4,5') {
			day_str = 'Weekdays'
		} else if (day_str === '0,6') {
			day_str = 'Weekends'
		} else {
			try {
				day_str = days.map((d) => moment().weekday(d).format('ddd')).join(', ')
			} catch (e) {
				day_str = 'Error'
			}
		}

		return `<strong>${day_str}</strong>, ${config.time}`
	}

	/**
	 * @return {Array.<{id: number, label: string}>} List of days
	 */
	_day_list() {
		return [...Array(7).keys()].map((i) => {
			return {
				id: i,
				label: moment().weekday(i).format(this.day_format),
			}
		})
	}

	get name() {
		return 'Time of day'
	}

	get type() {
		return 'tod'
	}

	/**
	 * Checks if event should work
	 * @param {number} day
	 * @param {string} hms
	 */
	matches(day, hms) {
		this.watch
			.filter((x) => x.config.days.includes(day) && x.config.time === hms)
			.forEach((x) => this.scheduler.action(x.id))
	}
}

module.exports = time_of_day
