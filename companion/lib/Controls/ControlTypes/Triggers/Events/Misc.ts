import { ParseControlId } from '@companion-app/shared/ControlId.js'
import LogController, { type Logger } from '../../../../Log/Controller.js'
import type { TriggerEvents } from '../../../../Controls/TriggerEvents.js'
import { TriggerExecutionSource } from '../TriggerExecutionSource.js'

interface ConnectEvent {
	id: string
	delay: number
}
interface PressEvent {
	id: string
	pressed: boolean
	delay?: undefined
}
interface LockEvent {
	id: string
	isLocked: boolean
	delay?: undefined
}
interface StartupEvent {
	id: string
	delay: number
}

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
 */
export class TriggersEventMisc {
	/**
	 * Enabled events listening for client connect
	 */
	#clientConnectEvents: ConnectEvent[] = []

	/**
	 * Enabled events listening for button presses
	 */
	#controlPressEvents: PressEvent[] = []

	/**
	 * Enabled events listening for computer locked or unlocked events
	 */
	#computerLockEvents: LockEvent[] = []

	/**
	 * Whether the trigger is currently enabled
	 */
	#enabled: boolean = false

	/**
	 * Shared event bus, across all triggers
	 */
	readonly #eventBus: TriggerEvents

	/**
	 * Execute the actions of the parent trigger
	 */
	readonly #executeActions: (nowTime: number, source: TriggerExecutionSource) => void

	/**
	 * The logger for this class
	 */
	readonly #logger: Logger

	/**
	 * Enabled events listening for startup
	 */
	#startupEvents: StartupEvent[] = []

	constructor(
		eventBus: TriggerEvents,
		controlId: string,
		executeActions: (nowTime: number, source: TriggerExecutionSource) => void
	) {
		this.#logger = LogController.createLogger(`Controls/Triggers/Events/Misc/${controlId}`)

		this.#eventBus = eventBus
		this.#executeActions = executeActions

		// Start listening for the events
		this.#eventBus.on('startup', this.#onStartup)
		this.#eventBus.on('locked', this.#onLockedState)
		this.#eventBus.on('client_connect', this.#onClientConnect)
		this.#eventBus.on('control_press', this.#onControlPress)
	}

	/**
	 * Destroy this event handler
	 */
	destroy(): void {
		this.#eventBus.off('startup', this.#onStartup)
		this.#eventBus.off('locked', this.#onLockedState)
		this.#eventBus.off('client_connect', this.#onClientConnect)
		this.#eventBus.off('control_press', this.#onControlPress)
	}

	/**
	 * Handler for the control_press event
	 * @param _controlId Id of the control which was pressed
	 * @param pressed Whether the control was pressed or depressed.
	 * @param surfaceId Source of the event
	 */
	#onControlPress = (_controlId: string, pressed: boolean, surfaceId: string | undefined): void => {
		if (this.#enabled) {
			// If the press originated from a trigger, then ignore it
			const parsedSurfaceId = surfaceId ? ParseControlId(surfaceId) : undefined
			if (parsedSurfaceId?.type === 'trigger') return

			let execute = false

			// Check for an event for this pressed state
			for (const event of this.#controlPressEvents) {
				if (!!event.pressed === !!pressed) {
					execute = true
				}
			}

			// If one was found, then execute the actions
			if (execute) {
				const nowTime = Date.now()

				setImmediate(() => {
					try {
						this.#executeActions(nowTime, TriggerExecutionSource.Other)
					} catch (e: any) {
						this.#logger.warn(`Execute actions failed: ${e?.toString?.() ?? e?.message ?? e}`)
					}
				})
			}
		}
	}

	/**
	 * Handler for the computer_locked and computer_unlocked event
	 */
	#onLockedState = (isLocked: boolean): void => {
		const events = this.#computerLockEvents.filter((evt) => evt.isLocked === isLocked)
		return this.#runEvents(events)
	}

	/**
	 * Handler for the client_connect event
	 */
	#onClientConnect = (): void => this.#runEvents(this.#clientConnectEvents)
	/**
	 * Handler for the startup event
	 */
	#onStartup = (): void => this.#runEvents(this.#startupEvents)

	/**
	 * Handler for an array of events
	 */
	#runEvents(events: ConnectEvent[] | PressEvent[] | LockEvent[] | StartupEvent[]): void {
		if (this.#enabled) {
			const nowTime = Date.now()

			for (const event of events) {
				setTimeout(() => {
					try {
						this.#executeActions(nowTime, TriggerExecutionSource.Other)
					} catch (e: any) {
						this.#logger.warn(`Execute actions failed: ${e?.toString?.() ?? e?.message ?? e}`)
					}
				}, event.delay || 0)
			}
		}
	}

	/**
	 * Set whether the events are enabled
	 */
	setEnabled(enabled: boolean): void {
		this.#enabled = enabled
	}

	/**
	 * Add a startup event listener
	 * @param id Id of the event
	 * @param delay Execution delay (ms) after the event fires
	 */
	setStartup(id: string, delay: number): void {
		this.clearStartup(id)

		this.#startupEvents.push({
			id,
			delay,
		})
	}

	/**
	 * Remove a startup event listener
	 */
	clearStartup(id: string): void {
		this.#startupEvents = this.#startupEvents.filter((int) => int.id !== id)
	}

	/**
	 * Add a client_connect event listener
	 * @param id Id of the event
	 * @param delay Execution delay (ms) after the event fires
	 */
	setClientConnect(id: string, delay: number): void {
		this.clearClientConnect(id)

		this.#clientConnectEvents.push({
			id,
			delay,
		})
	}

	/**
	 * Remove a client_connect event listener
	 */
	clearClientConnect(id: string): void {
		this.#clientConnectEvents = this.#clientConnectEvents.filter((int) => int.id !== id)
	}

	/**
	 * Add a control_press event listener
	 * @param id Id of the event
	 * @param pressed Listen for pressed or depressed events
	 */
	setControlPress(id: string, pressed: boolean): void {
		this.clearControlPress(id)

		this.#controlPressEvents.push({
			id,
			pressed,
		})
	}

	/**
	 * Remove a control_press event listener
	 */
	clearControlPress(id: string): void {
		this.#controlPressEvents = this.#controlPressEvents.filter((int) => int.id !== id)
	}

	/**
	 * Add a computer_locked or computer_unlocked event listener
	 * @param id Id of the event
	 * @param isLocked Listen for locked or unlocked events
	 */
	setComputerLocked(id: string, isLocked: boolean): void {
		this.clearComputerLocked(id)

		this.#computerLockEvents.push({
			id,
			isLocked,
		})
	}

	/**
	 * Remove a computer_locked or computer_unlocked event listener
	 */
	clearComputerLocked(id: string): void {
		this.#computerLockEvents = this.#computerLockEvents.filter((int) => int.id !== id)
	}
}
