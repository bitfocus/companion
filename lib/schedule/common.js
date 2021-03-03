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

class common {
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

	/**
	 * Does this plugin allow for multiple params?
	 * It's up to plugins on how this is actually implemented
	 */
	get multiple() {
		return false
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
	 * Setup plugin for events
	 * Called on plugin instantiation and should contain code that configures the plugin for watching events
	 */
	setup() {}
}

module.exports = common
