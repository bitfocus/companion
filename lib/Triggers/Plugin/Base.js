import shortid from 'shortid'

class TriggersPluginBase {
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

		const ps = []
		for (const act of data.actions) {
			const instance = this.scheduler.instance.moduleHost.getChild(act.instance)
			if (instance) {
				ps.push(instance.actionUpdate(act, undefined, undefined))
			}
		}
		Promise.all(ps).catch((e) => {
			// Ignore for now
		})
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
				const ps = []
				for (const act of data.actions) {
					const instance = this.scheduler.instance.moduleHost.getChild(act.instance)
					if (instance) {
						ps.push(instance.actionDelete(act))
					}
				}
				Promise.all(ps).catch((e) => {
					// Ignore for now
				})
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

export default TriggersPluginBase
