import TriggersPluginBase from './Base.js'
import moment from 'moment'

class TriggersPluginTimeOfDay extends TriggersPluginBase {
	config_desc(config) {
		let day_str = ''
		if (config.days) {
			const days = config.days
			day_str = days.toString()
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
		} else {
			day_str = 'Error'
		}

		return `<strong>${day_str}</strong>, ${config.time}`
	}
}

export default TriggersPluginTimeOfDay
