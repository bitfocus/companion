import { ParseControlId } from '../../../../Resources/Util.js'

/**
 * This is a special event runner, it handles miscellaneous simple events *
 *
 * @author Håkon Nessjøen <haakon@bitfocus.io>
 * @author Keith Rocheck <keith.rocheck@gmail.com>
 * @author William Viker <william@bitfocus.io>
 * @author Julian Waller <me@julusian.co.uk>
 * @since 3.0.0
 * @copyright 2022 Bitfocus AS
 * @license
 * This program is free software.
 * You should have received a copy of the MIT licence as well as the Bitfocus
 * Individual Contributor License Agreement for Companion along with
 * this program.
 *
 * You can be released from the requirements of the license by purchasing
 * a commercial license. Buying such a license is mandatory as soon as you
 * develop commercial activities involving the Companion software without
 * disclosing the source code of your own applications.
 */
export default class TriggersEventMisc {
	/**
	 * Enabled events listening for client connect
	 * @type {Array}
	 * @access private
	 */
	#clientConnectEvents = []

	/**
	 * Enabled events listening for button presses
	 * @type {Array}
	 * @access private
	 */
	#controlPressEvents = []

	/**
	 * Whether the trigger is currently enabled
	 * @type {boolean}
	 * @access private
	 */
	#enabled = false

	/**
	 * Shared event bus, across all triggers
	 * @type {EventEmitter}
	 * @access private
	 */
	#eventBus

	/**
	 * Execute the actions of the parent trigger
	 * @type {Function}
	 * @access private
	 */
	#executeActions

	/**
	 * The logger for this class
	 * @type {winston.Logger}
	 * @access protected
	 */
	logger

	/**
	 * Enabled events listening for startup
	 * @type {Array}
	 * @access private
	 */
	#startupEvents = []

	constructor(registry, eventBus, controlId, executeActions) {
		this.logger = registry.log.createLogger(`Controls/Triggers/Events/Misc/${controlId}`)

		this.#eventBus = eventBus
		this.#executeActions = executeActions

		// Start listening for the events
		this.#eventBus.on('startup', this.#onStartup)
		this.#eventBus.on('client_connect', this.#onClientConnect)
		this.#eventBus.on('control_press', this.#onControlPress)
	}

	/**
	 * Destroy this event handler
	 * @access public
	 */
	destroy() {
		this.#eventBus.off('startup', this.#onStartup)
		this.#eventBus.off('client_connect', this.#onClientConnect)
		this.#eventBus.off('control_press', this.#onControlPress)
	}

	/**
	 * Handler for the control_press event
	 * @param {string} controlId Id of the control which was pressed
	 * @param {boolean} pressed Whether the control was pressed or depressed.
	 * @param {string | undefined} deviceId Source of the event
	 * @access private
	 */
	#onControlPress = (controlId, pressed, deviceId) => {
		if (this.#enabled) {
			// If the press originated from a trigger, then ignore it
			const parsedDeviceId = ParseControlId(deviceId)
			if (parsedDeviceId.type === 'trigger') return

			const nowTime = Date.now()

			let execute = false

			// Check for an event for this pressed state
			for (const event of this.#controlPressEvents) {
				if (!!event.pressed === !!pressed) {
					execute = true
				}
			}

			// If one was found, then execute the actions
			if (execute) {
				setImmediate(() => {
					try {
						this.#executeActions(nowTime)
					} catch (e) {
						this.logger.warn(`Execute actions failed: ${e?.toString?.() ?? e?.message ?? e}`)
					}
				})
			}
		}
	}

	/**
	 * Handler for the client_connect event
	 * @access private
	 */
	#onClientConnect = () => this.#runEvents(this.#clientConnectEvents)
	/**
	 * Handler for the startup event
	 * @access private
	 */
	#onStartup = () => this.#runEvents(this.#startupEvents)

	/**
	 * Handler for an array of events
	 * @param {Array} array of events
	 * @access private
	 */
	#runEvents(events) {
		if (this.#enabled) {
			const nowTime = Date.now()

			for (const event of events) {
				setTimeout(() => {
					try {
						this.#executeActions(nowTime)
					} catch (e) {
						this.logger.warn(`Execute actions failed: ${e?.toString?.() ?? e?.message ?? e}`)
					}
				}, event.delay || 0)
			}
		}
	}

	/**
	 * Set whether the events are enabled
	 * @param {boolean} enabled
	 */
	setEnabled(enabled) {
		this.#enabled = enabled
	}

	/**
	 * Add a startup event listener
	 * @param {string} id Id of the event
	 * @param {number} delay Execution delay (ms) after the event fires
	 */
	setStartup(id, delay) {
		this.clearStartup(id)

		this.#startupEvents.push({
			id,
			delay,
		})
	}

	/**
	 * Remove a startup event listener
	 * @param {string} id Id of the event
	 */
	clearStartup(id) {
		this.#startupEvents = this.#startupEvents.filter((int) => int.id !== id)
	}

	/**
	 * Add a client_connect event listener
	 * @param {string} id Id of the event
	 * @param {number} delay Execution delay (ms) after the event fires
	 */
	setClientConnect(id, delay) {
		this.clearClientConnect(id)

		this.#clientConnectEvents.push({
			id,
			delay,
		})
	}

	/**
	 * Remove a client_connect event listener
	 * @param {string} id Id of the event
	 */
	clearClientConnect(id) {
		this.#clientConnectEvents = this.#clientConnectEvents.filter((int) => int.id !== id)
	}

	/**
	 * Add a control_press event listener
	 * @param {string} id Id of the event
	 * @param {boolean} pressed Listen for pressed or depressed events
	 */
	setControlPress(id, pressed) {
		this.clearControlPress(id)

		this.#controlPressEvents.push({
			id,
			pressed,
		})
	}

	/**
	 * Remove a control_press event listener
	 * @param {string} id Id of the event
	 */
	clearControlPress(id) {
		this.#controlPressEvents = this.#controlPressEvents.filter((int) => int.id !== id)
	}
}
