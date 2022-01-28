const shortid = require('shortid')

class plugin_base {
	/**
	 * @param {scheduler} scheduler
	 */
	constructor(scheduler) {
		this.scheduler = scheduler
		this.watch = []
		this.setup()
	}

	/**
	 * Add event to watch for
	 * @param {number} id
	 * @param {Object} data
	 */
	add(id, data) {
		this.watch.push(data)

		for (const act of data.actions) {
			this.scheduler.system.emit('action_subscribe', act)
		}
	}

	/**
	 * Clone an event config
	 */
	clone(config) {
		const new_config = JSON.parse(JSON.stringify(config))

		console.log('clone', new_config)

		if (Array.isArray(new_config.actions)) {
			for (const action of new_config.actions) {
				action.id = shortid.generate()
			}
		}

		return new_config
	}

	/**
	 * Remove event from watch list
	 * @param {number} id
	 */
	remove(id) {
		const idx = this.watch.findIndex((x) => x.id === id)

		if (idx !== -1) {
			const data = this.watch[idx]
			if (data) {
				for (const act of data.actions) {
					this.scheduler.system.emit('action_unsubscribe', act)
				}
			}

			this.watch.splice(idx, 1)
		}
	}

	/**
	 * Setup plugin for events
	 * Called on plugin instantiation and should contain code that configures the plugin for watching events
	 */
	setup() {}

	/**
	 * @return {string} String description to show on front end event list
	 */
	config_desc() {}

	/**
	 * Parameters needed for the front end configuration
	 */
	front_end() {
		return {
			type: this.type,
			options: this.options,
			name: this.name,
		}
	}
}

module.exports = plugin_base
