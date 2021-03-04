const plugin_base = require('./plugin_base')
const moment = require('moment')

class time_of_day extends plugin_base {
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

	get type() {
		return 'tod'
	}

	get name() {
		return 'Time of day'
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
}

module.exports = time_of_day
