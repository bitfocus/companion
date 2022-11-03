/**
 * This is a special event runner, it operates for
 */
export default class TriggersEventMisc {
	/**
	 * The logger for this class
	 * @type {winston.Logger}
	 * @access protected
	 */
	logger

	#executeActions

	#startupEvents = []
	#clientConnectEvents = []
	#controlPressEvents = []

	#eventBus

	#enabled = false

	constructor(registry, eventBus, controlId, executeActions) {
		this.logger = registry.log.createLogger(`Controls/Triggers/Events/Misc/${controlId}`)

		this.#eventBus = eventBus
		this.#executeActions = executeActions

		this.#eventBus.on('startup', this.#onStartup)
		this.#eventBus.on('client_connect', this.#onClientConnect)
		this.#eventBus.on('control_press', this.#onControlPress)
	}

	destroy() {
		this.#eventBus.off('startup', this.#onStartup)
		this.#eventBus.off('client_connect', this.#onClientConnect)
		this.#eventBus.off('control_press', this.#onControlPress)
	}

	runEvents(events) {
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

	#onStartup = () => this.runEvents(this.#startupEvents)
	#onClientConnect = () => this.runEvents(this.#clientConnectEvents)
	#onControlPress = () => this.runEvents(this.#controlPressEvents)

	setEnabled(enabled) {
		this.#enabled = enabled
	}

	setStartup(id, delay) {
		this.clearStartup(id)

		this.#startupEvents.push({
			id,
			delay,
		})
	}
	clearStartup(id) {
		this.#startupEvents = this.#startupEvents.filter((int) => int.id !== id)
	}

	setClientConnect(id, delay) {
		this.clearClientConnect(id)

		this.#clientConnectEvents.push({
			id,
			delay,
		})
	}
	clearClientConnect(id) {
		this.#clientConnectEvents = this.#clientConnectEvents.filter((int) => int.id !== id)
	}

	setControlPress(id, pressed) {
		this.clearControlPress(id)

		this.#controlPressEvents.push({
			id,
			pressed,
		})
	}
	clearControlPress(id) {
		this.#controlPressEvents = this.#controlPressEvents.filter((int) => int.id !== id)
	}
}
