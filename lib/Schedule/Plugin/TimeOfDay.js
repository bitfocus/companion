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
const moment = require('moment')

class SchedulePluginTimeOfDay extends SchedulePluginBase {
	setup() {
		this.dayFormat = 'ddd'

		this.intervalWatch = setInterval(() => {
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
				choices: this.dayList(),
			},
		]
	}

	configDesc(config) {
		const days = config.days
		let dayStr = days.toString()

		if (days.length === 7) {
			dayStr = 'Daily'
		} else if (dayStr === '1,2,3,4,5') {
			dayStr = 'Weekdays'
		} else if (dayStr === '0,6') {
			dayStr = 'Weekends'
		} else {
			try {
				dayStr = days.map((d) => moment().weekday(d).format('ddd')).join(', ')
			} catch (e) {
				dayStr = 'Error'
			}
		}

		return `<strong>${dayStr}</strong>, ${config.time}`
	}

	/**
	 * @return {Array.<{id: number, label: string}>} List of days
	 * @access protected
	 */
	dayList() {
		return [...Array(7).keys()].map((i) => {
			return {
				id: i,
				label: moment().weekday(i).format(this.dayFormat),
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
			.forEach((x) => this.controller.action(x.id))
	}
}

module.exports = SchedulePluginTimeOfDay
