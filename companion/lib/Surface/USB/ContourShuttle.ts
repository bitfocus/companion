/*
 * This file is part of the Companion project
 * Copyright (c) 2023 Peter Newman
 * Author: Peter Newman
 *
 * This program is free software.
 * You should have received a copy of the MIT licence as well as the Bitfocus
 * Individual Contributor License Agreement for companion along with
 * this program.
 */

import EventEmitter from 'events'
import { setupShuttle, ProductModelId, type Shuttle } from 'shuttle-node'
import LogController, { type Logger } from '../../Log/Controller.js'
import { LockConfigFields, OffsetConfigFields, RotationConfigField } from '../CommonConfigFields.js'
import type { CompanionSurfaceConfigField, GridSize } from '@companion-app/shared/Model/Surfaces.js'
import type { SurfacePanel, SurfacePanelEvents, SurfacePanelInfo } from '../Types.js'
import { assertNever } from '@companion-app/shared/Util.js'

interface ShuttleModelInfo {
	totalCols: number
	totalRows: number
	jog: [number, number]
	shuttle: [number, number]
	shuttleRepeating: [number, number]
	buttons: [number, number][]
}

const contourShuttleXpressInfo: ShuttleModelInfo = {
	// Treat as:
	// 3 buttons
	// button, two encoders (jog and shuttle), button
	// Map the encoders in the same position (but a different row) for consistency and compatibility
	totalCols: 4,
	totalRows: 2,

	//  [column, row] (reversed from how Admin displays it)
	jog: [1, 1],
	shuttle: [2, 1],
	shuttleRepeating: [3, 1],
	buttons: [
		[0, 1],
		[0, 0],
		[1, 0],
		[2, 0],
		[3, 0],
		[3, 1],
	],
}
const contourShuttleProV1Info: ShuttleModelInfo = {
	// Same as Pro V2 only without the buttons either side of the encoders
	// Map the same for consistency and compatibility
	totalCols: 5,
	totalRows: 4,

	//  [column, row] (reversed from how Admin displays it)
	jog: [1, 2],
	shuttle: [2, 2],
	shuttleRepeating: [3, 2],
	buttons: [
		// 4 buttons
		[0, 0],
		[1, 0],
		[2, 0],
		[3, 0],

		// 5 buttons
		[0, 1],
		[1, 1],
		[2, 1],
		[3, 1],
		[4, 1],

		// 2 buttons (combine with below)
		[0, 3],
		[3, 3],

		// 2 buttons
		[1, 3],
		[2, 3],
	],
}
const contourShuttleProV2Info: ShuttleModelInfo = {
	// 4 buttons
	// 5 buttons
	// button, two encoders (jog and shuttle), button
	// 2 buttons (combine with the row below)
	// 2 buttons
	totalCols: 5,
	totalRows: 4,

	//  [column, row] (reversed from how Admin displays it)
	jog: [1, 2],
	shuttle: [2, 2],
	shuttleRepeating: [3, 2],
	buttons: [
		// 4 buttons
		[0, 0],
		[1, 0],
		[2, 0],
		[3, 0],

		// 5 buttons
		[0, 1],
		[1, 1],
		[2, 1],
		[3, 1],
		[4, 1],

		// 2 buttons (combine with below)
		[0, 3],
		[3, 3],

		// 2 buttons
		[1, 3],
		[2, 3],

		// 2 buttons either side of encoder
		[0, 2],
		[4, 2], // moved over one to make room for shuttleRepeat
	],
}

function buttonToXy(modelInfo: ShuttleModelInfo, info: number): [number, number] | undefined {
	return modelInfo.buttons[info]
}

const configFields: CompanionSurfaceConfigField[] = [
	...OffsetConfigFields,
	RotationConfigField,
	...LockConfigFields,

	{
		id: 'jogValueVariable',
		type: 'custom-variable',
		label: 'Variable to store Jog value to',
		tooltip: 'This will pulse with -1 or 1 before returning to 0 when rotated.',
	},
	{
		id: 'shuttleValueVariable',
		type: 'custom-variable',
		label: 'Variable to store Shuttle value to',
		tooltip: 'This produces a value between -7 and 7. You can use an expression to convert it into a different range.',
	},
]

export class SurfaceUSBContourShuttle extends EventEmitter<SurfacePanelEvents> implements SurfacePanel {
	readonly #logger: Logger

	private readonly contourShuttle: Shuttle
	private readonly modelInfo: ShuttleModelInfo

	config: Record<string, any>

	readonly info: SurfacePanelInfo
	readonly gridSize: GridSize

	private static devices = new Set<string>() // ids of currently-attached devices
	private static makeDeviceId(devname: string): string {
		// this function ensures we don't assign the same id twice.
		// for example with two devices, if user unplugs dev1 and replugs it, then
		//   if we were simply tracking the number of devices, both devices would be assigned "dev2"
		//  This code will reassign "dev1" instead...
		let n = 1
		while (true) {
			const deviceId = `contourshuttle:${devname}-dev${n++}`
			if (!SurfaceUSBContourShuttle.devices.has(deviceId)) {
				SurfaceUSBContourShuttle.devices.add(deviceId)
				return deviceId
			}
		}
	}

	#shuttleRing: { val: number; interval: ReturnType<typeof setInterval> | undefined }

	constructor(devicePath: string, contourShuttle: Shuttle, modelInfo: ShuttleModelInfo) {
		super()

		this.#logger = LogController.createLogger(`Surface/USB/ContourShuttle/${devicePath}`)

		this.contourShuttle = contourShuttle
		this.modelInfo = modelInfo

		this.config = {
			// No config currently present
		}

		this.#shuttleRing = { val: 0, interval: undefined }

		this.#logger.debug(`Adding Contour Shuttle USB device ${devicePath}`)

		// The devices don't have serialnumbers, so assign device IDs serially
		const fakeDeviceId = SurfaceUSBContourShuttle.makeDeviceId(contourShuttle.info.productModelId)

		this.info = {
			type: `Contour Shuttle ${contourShuttle.info.name}`,
			devicePath: devicePath,
			configFields: configFields,
			deviceId: fakeDeviceId,
		}

		this.gridSize = {
			columns: this.modelInfo.totalCols,
			rows: this.modelInfo.totalRows,
		}

		this.contourShuttle.on('error', (error) => {
			console.error(error)
			this.clearRepeatingActions()
			this.emit('remove')
		})

		this.contourShuttle.on('down', (info) => {
			const xy = buttonToXy(this.modelInfo, info)
			if (xy === undefined) {
				return
			}

			this.emit('click', ...xy, true)
		})

		this.contourShuttle.on('up', (info) => {
			const xy = buttonToXy(this.modelInfo, info)
			if (xy === undefined) {
				return
			}

			this.emit('click', ...xy, false)
		})

		this.contourShuttle.on('jog', (delta) => {
			const xy = this.modelInfo.jog
			if (xy === undefined) {
				return
			}

			//console.log(`Jog position has changed`, delta)
			const jogVariableName = this.config.jogValueVariable
			if (jogVariableName) {
				this.#logger.debug(`Setting jog variable ${jogVariableName} to ${delta}`)
				this.emit('setCustomVariable', jogVariableName, delta)
				setTimeout(() => {
					this.emit('setCustomVariable', jogVariableName, 0)
				}, 20)
			}

			this.emit('rotate', ...xy, delta == 1)
		})

		this.contourShuttle.on('shuttle', (shuttle) => {
			const shuttleInfo = this.#shuttleRing
			// Fibonacci sequence provides nice acceleration: small changes at first then larger changes
			// could be an array constant but is more resilient this way
			// For 7 values: [1, 2, 3, 5, 8, 13, 21]
			const fibonacci = (n: number) => {
				let f = [0, 1]
				for (let c = 1; c < n; c++) {
					f = [f[1], f[0] + f[1]]
				}
				return f[1]
			}
			const xy = this.modelInfo.shuttle
			const xyRepeating = this.modelInfo.shuttleRepeating
			if (xy === undefined || xyRepeating === undefined) {
				return
			}

			// do this before emitting any events:
			const shuttleVariableName = this.config.shuttleValueVariable
			if (shuttleVariableName) {
				this.#logger.debug(`Setting shuttle variable ${shuttleVariableName} to ${shuttle}`)
				this.emit('setCustomVariable', shuttleVariableName, shuttle)
			}

			// Direction of rotation events (true triggers "rotate-right") is different than for knobs
			// because the ring has limited travel and always springs back to zero. In typical usage,
			// a shuttle-ring emits "go forward" commands if shuttle > 0 and "reverse" commands when
			// it's on the negative side of zero, regardless of direction of rotation.
			// So we define "rotate-right/left" here to mean right/left side of zero (i.e. positive/negative values)
			const isRightward = shuttle > 0 || shuttleInfo.val > 0

			const firstAction = shuttleInfo.interval == undefined // must be stored before clearRepeatingActions()
			this.clearRepeatingActions()
			this.emit('rotate', ...xy, isRightward) // always emit a single non-repeating event

			// repeating events:
			// Note:
			// If shuttle is zero, user released the spring-loaded ring and we're done (and shouldn't emit an action)
			// The interval has already been cleared, above.
			// Unfortunately, there's no equivalent of button-release on rotation actions
			// So if the user needs to react to shuttle-ring release, they will have to add logic
			// to the non-repeating button for shuttle===0. (Maybe we add a feedback? internal:shuttle-released?
			// ...Or a 'shuttle-released' variable similar to the 'jog' variable above ???)
			if (firstAction) {
				// when user moves off of zero, issue the first rotation action immediately
				this.emit('rotate', ...xyRepeating, isRightward)
			}

			if (shuttle !== 0) {
				// repeat rate increases as shuttle ring is rotated in further either direction. (shuttle varies from 1-7)
				shuttleInfo.interval = setInterval(
					() => {
						this.emit('rotate', ...xyRepeating, isRightward)
					},
					1000 / fibonacci(Math.abs(shuttle))
				) // vary from 1 to 21 reps/second (roughly 1000 - 50 ms intervals)
			}
			shuttleInfo.val = shuttle
		})

		// clear shuttle-ring activity.
		this.contourShuttle.on('disconnected', () => {
			this.clearRepeatingActions()
			this.emit('remove')
		})
	}

	clearRepeatingActions(): void {
		const shuttleInfo = this.#shuttleRing
		if (shuttleInfo.interval !== undefined) {
			clearInterval(shuttleInfo.interval)
			shuttleInfo.interval = undefined
		}
	}

	/**
	 * Open a contour shuttle
	 */
	static async create(devicePath: string): Promise<SurfaceUSBContourShuttle> {
		const contourShuttle = await setupShuttle(devicePath)

		try {
			let info: ShuttleModelInfo

			switch (contourShuttle.info.productModelId) {
				case ProductModelId.ShuttleXpress:
					info = contourShuttleXpressInfo
					break
				case ProductModelId.ShuttleProV1:
				case ProductModelId.ShuttleProV1a:
					info = contourShuttleProV1Info
					break
				case ProductModelId.ShuttleProV2:
					info = contourShuttleProV2Info
					break
				default:
					assertNever(contourShuttle.info.productModelId)
					throw new Error(`Unknown Contour Shuttle device detected: ${contourShuttle.info.name}`)
			}

			const self = new SurfaceUSBContourShuttle(devicePath, contourShuttle, info)

			return self
		} catch (e) {
			await contourShuttle.close()

			throw e
		}
	}

	/**
	 * Process the information from the GUI and what is saved in database
	 * @returns false when nothing happens
	 */
	setConfig(config: Record<string, any>, _force = false): void {
		// No config currently present
		this.config = config
	}

	quit(): void {
		this.clearRepeatingActions()
		SurfaceUSBContourShuttle.devices.delete(this.info.deviceId)
		this.contourShuttle.close().catch((e) => {
			this.#logger.error(`Failed to close contour shuttle: ${e}`)
		})
	}

	draw(): void {
		// Should never be fired
	}

	clearDeck(): void {
		// Not relevant for this device
	}
}
