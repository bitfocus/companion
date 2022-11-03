import TriggersPluginBase from './Base.js'

class TriggersPluginInterval extends TriggersPluginBase {
	config_desc(config) {
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
}

export default TriggersPluginInterval
