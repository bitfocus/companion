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
	}

	/**
	 * Remove event from watch list
	 * @param {number} id
	 */
	remove(id) {
		const idx = this.watch.findIndex((x) => x.id === id)
		if (idx !== -1) {
			this.watch.splice(idx, 1)
		}
	}

	/**
	 * Does this plugin allow for multiple params?
	 * It's up to plugins on how this is actually implemented
	 */
	get multiple() {
		return false
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
			multiple: this.multiple,
		}
	}
}

module.exports = plugin_base
