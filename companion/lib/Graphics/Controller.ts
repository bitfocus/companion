/*
 * This file is part of the Companion project
 * Copyright (c) 2018 Bitfocus AS
 * Authors: William Viker <william@bitfocus.io>, Håkon Nessjøen <haakon@bitfocus.io>
 *
 * This program is free software.
 * You should have received a copy of the MIT licence as well as the Bitfocus
 * Individual Contributor License Agreement for companion along with
 * this program.
 */

import { LRUCache } from 'lru-cache'
import { GlobalFonts } from '@napi-rs/canvas'
import { GraphicsRenderer } from './Renderer.js'
import { ParseControlId, xyToOldBankIndex } from '@companion-app/shared/ControlId.js'
import type { ImageResult } from './ImageResult.js'
import { ImageWriteQueue } from '../Resources/ImageWriteQueue.js'
import workerPool from 'workerpool'
import { isPackaged } from '../Resources/Util.js'
import { fileURLToPath } from 'url'
import path from 'path'
import debounceFn from 'debounce-fn'
import type { CompanionButtonStyleProps, CompanionVariableValues } from '@companion-module/base'
import type { DrawStyleModel } from '@companion-app/shared/Model/StyleModel.js'
import type { ControlLocation } from '@companion-app/shared/Model/Common.js'
import { EventEmitter } from 'events'
import LogController from '../Log/Controller.js'
import type { DataUserConfig } from '../Data/UserConfig.js'
import type { IPageStore } from '../Page/Store.js'
import type { ControlsController } from '../Controls/Controller.js'
import type { VariablesValues, VariableValueEntry } from '../Variables/Values.js'
import { GraphicsThreadMethods } from './ThreadMethods.js'

const CRASHED_WORKER_RETRY_COUNT = 10
const WORKER_TERMINATION_WINDOW_MS = 60_000 // 1 minute
const WORKER_TERMINATION_THRESHOLD = 30 // High limit, to catch extreme cases

const DEBUG_DISABLE_RENDER_THREADING = process.env.DEBUG_DISABLE_RENDER_THREADING === '1'

export interface GraphicsOptions {
	page_direction_flipped: boolean
	page_plusminus: boolean
	remove_topbar: boolean
}

/**
 * Generate full path to a font file, handling both packaged and non-packaged environments
 */
function generateFontUrl(fontFilename: string): string {
	const fontPath = isPackaged() ? 'assets/Fonts' : '../../../assets/Fonts'
	// we could simplify by using import.meta.dirname
	return fileURLToPath(new URL(path.join(fontPath, fontFilename), import.meta.url))
}

interface GraphicsControllerEvents {
	button_drawn: [location: ControlLocation, render: ImageResult]
	presetDrawn: [controlId: string, render: ImageResult]
	resubscribeFeedbacks: []
}

interface RenderArgumentsButton {
	type: 'button'
	location: ControlLocation
}
interface RenderArgumentsPreset {
	type: 'preset'
	controlId: string
}
type RenderArguments = RenderArgumentsButton | RenderArgumentsPreset

export class GraphicsController extends EventEmitter<GraphicsControllerEvents> {
	readonly #logger = LogController.createLogger('Graphics/Controller')

	readonly #controlsController: ControlsController
	readonly #pageStore: IPageStore
	readonly #userConfigController: DataUserConfig
	readonly #variableValuesController: VariablesValues

	private blinkTimeout = new Map<string, { timeout: NodeJS.Timeout; state: boolean }>()

	/**
	 * Cached UserConfig values that affect button rendering
	 */
	readonly #drawOptions: GraphicsOptions

	/**
	 * Current button renders cache
	 */
	readonly #renderCache = new Map<number, Map<number, Map<number, ImageResult>>>()

	/**
	 * Last recently used cache for button renders
	 */
	readonly #renderLRUCache = new LRUCache<string, ImageResult>({ max: 100 })

	readonly #renderQueue: ImageWriteQueue<string, [RenderArguments, boolean]>

	#pool = workerPool.pool(
		// note: import.meta.url can be replaced with import.meta.directory as long as we use node v22.16 and later
		fileURLToPath(new URL(isPackaged() ? './RenderThread.js' : './Thread.js', import.meta.url)),
		{
			minWorkers: 2,
			maxWorkers: 6,
			workerType: 'thread',
			onCreateWorker: () => {
				this.#logger.info('Render worker created')
				return undefined
			},
			onTerminateWorker: () => {
				this.#logger.info('Render worker terminated')
			},
		}
	)

	// Track recent worker terminations (timestamps in ms)
	#workerTerminationTimestamps: number[] = []

	#poolExec = async <TKey extends keyof typeof GraphicsThreadMethods>(
		key: TKey,
		args: Parameters<(typeof GraphicsThreadMethods)[TKey]>,
		attempts: number
	): Promise<ReturnType<(typeof GraphicsThreadMethods)[TKey]>> => {
		if (DEBUG_DISABLE_RENDER_THREADING) {
			return (GraphicsThreadMethods[key] as any)(...args)
		}

		return this.#pool.exec(key, args).catch(async (e) => {
			// if a worker crashes, the first attempt will fail, retry when that happens, but not infinitely
			if (attempts > 1 && (e instanceof workerPool.TerminateError || e?.message?.includes('Worker is terminated'))) {
				// Track termination timestamps in a sliding window

				const now = Date.now()
				this.#workerTerminationTimestamps.push(now)
				const cutoff = now - WORKER_TERMINATION_WINDOW_MS

				// prune old timestamps
				this.#workerTerminationTimestamps = this.#workerTerminationTimestamps.filter((timestamp) => timestamp >= cutoff)

				if (this.#workerTerminationTimestamps.length > WORKER_TERMINATION_THRESHOLD) {
					this.#logger.error(
						`More than ${WORKER_TERMINATION_THRESHOLD} worker terminations within ${WORKER_TERMINATION_WINDOW_MS / 1000}s. Terminating.`
					)
					// Force an immediate exit, as this suggests a major problem
					// eslint-disable-next-line n/no-process-exit
					process.exit(5)
				}

				return this.#poolExec(key, args, attempts - 1)
			} else {
				throw e
			}
		})
	}

	/**
	 * Generated pincode bitmaps
	 */
	#pincodeBuffersCache: Omit<PincodeBitmaps, 'code'> | null = null

	#pendingVariables: CompanionVariableValues | null = null
	/**
	 * Debounce updating the variables, as buttons are often drawn in floods
	 */
	#debouncePendingVariables = debounceFn(
		() => {
			const values = this.#pendingVariables
			if (values) {
				this.#pendingVariables = null

				// This isn't ideal, but ensures we don't report duplicate changes
				const valuesArr: VariableValueEntry[] = Object.entries(values).map(([id, value]) => ({
					id,
					value,
				}))

				this.#variableValuesController.setVariableValues('internal', valuesArr)
			}
		},
		{
			wait: 10,
			maxWait: 40,
		}
	)

	constructor(
		controlsController: ControlsController,
		pageStore: IPageStore,
		userConfigController: DataUserConfig,
		variableValuesController: VariablesValues
	) {
		super()

		this.#controlsController = controlsController
		this.#pageStore = pageStore
		this.#userConfigController = userConfigController
		this.#variableValuesController = variableValuesController

		this.setMaxListeners(0)

		this.#drawOptions = {
			page_direction_flipped: this.#userConfigController.getKey('page_direction_flipped'),
			page_plusminus: this.#userConfigController.getKey('page_plusminus'),
			remove_topbar: this.#userConfigController.getKey('remove_topbar'),
		}

		this.#renderQueue = new ImageWriteQueue(
			this.#logger,
			async (id: string, args: RenderArguments, skipInvalidation: boolean) => {
				try {
					if (args.type === 'preset') {
						const control = this.#controlsController.getControl(args.controlId)
						const buttonStyle = control?.getDrawStyle() ?? undefined

						let render: ImageResult | undefined
						if (buttonStyle && buttonStyle.style) {
							// Check if the image is already present in the render cache and if so, return it

							const key = JSON.stringify({ options: this.#drawOptions, buttonStyle })
							render = this.#renderLRUCache.get(key)

							if (!render) {
								const { buffer, width, height, dataUrl, draw_style } = await this.#executePoolDrawButtonImage(
									buttonStyle,
									undefined,
									undefined,
									CRASHED_WORKER_RETRY_COUNT
								)
								render = GraphicsRenderer.wrapDrawButtonImage(buffer, width, height, dataUrl, draw_style, buttonStyle)
							}
						} else {
							render = GraphicsRenderer.drawBlank(this.#drawOptions, null)
						}

						this.emit('presetDrawn', args.controlId, render)
						return
					}

					const { location } = args

					const gridSize = this.#userConfigController.getKey('gridSize')
					const locationIsInBounds =
						location &&
						gridSize &&
						location.column <= gridSize.maxColumn &&
						location.column >= gridSize.minColumn &&
						location.row <= gridSize.maxRow &&
						location.row >= gridSize.minRow

					const controlId = this.#pageStore.getControlIdAt(location)
					const control = controlId ? this.#controlsController.getControl(controlId) : undefined
					const buttonStyle = control?.getDrawStyle() ?? undefined

					if (location && locationIsInBounds) {
						// Update the internal b_text_1_4 variable
						setImmediate(() => {
							const values: CompanionVariableValues = {}

							// Update text, if it is present
							values[`b_text_${location.pageNumber}_${location.row}_${location.column}`] =
								buttonStyle?.style === 'button' ? buttonStyle.text : undefined
							const bankIndex = xyToOldBankIndex(location.column, location.row)
							if (bankIndex)
								values[`b_text_${location.pageNumber}_${bankIndex}`] =
									buttonStyle?.style === 'button' ? buttonStyle.text : undefined

							// Update step
							values[`b_step_${location.pageNumber}_${location.row}_${location.column}`] =
								buttonStyle?.style === 'button' ? buttonStyle.stepCurrent : undefined
							values[`b_step_count_${location.pageNumber}_${location.row}_${location.column}`] =
								buttonStyle?.style === 'button' ? buttonStyle.stepCount : undefined

							// Submit the updated values
							if (this.#pendingVariables) {
								Object.assign(this.#pendingVariables, values)
							} else {
								this.#pendingVariables = values
							}
							this.#debouncePendingVariables()
						})
					}

					let render: ImageResult | undefined
					if (location && locationIsInBounds && buttonStyle && buttonStyle.style) {
						const pagename = this.#pageStore.getPageName(location.pageNumber)
						if (!buttonStyle.pushed && buttonStyle.blink) {
							const { state, timeout } = this.blinkTimeout.get(id) ?? { state: true, timeout: null }
							if (timeout) timeout.close()
							this.blinkTimeout.set(id, {
								timeout: setTimeout(() => this.#renderQueue.queue(id, args, skipInvalidation), buttonStyle.blink),
								state: !state,
							})
							if (!state) buttonStyle.bgcolor = 0
						}

						// Check if the image is already present in the render cache and if so, return it
						let keyLocation: ControlLocation | undefined
						if (buttonStyle.style === 'button') {
							const globalShowTopBar = !this.#drawOptions.remove_topbar && buttonStyle.show_topbar === 'default'
							keyLocation = globalShowTopBar || buttonStyle.show_topbar === true ? location : undefined
						}
						const key = JSON.stringify({ options: this.#drawOptions, buttonStyle, keyLocation, pagename })
						render = this.#renderLRUCache.get(key)

						if (!render) {
							const { buffer, width, height, dataUrl, draw_style } = await this.#executePoolDrawButtonImage(
								buttonStyle,
								location,
								pagename,
								CRASHED_WORKER_RETRY_COUNT
							)
							render = GraphicsRenderer.wrapDrawButtonImage(buffer, width, height, dataUrl, draw_style, buttonStyle)
						}
					} else {
						render = GraphicsRenderer.drawBlank(this.#drawOptions, location)
					}

					// Only cache the render, if it is within the valid bounds
					if (locationIsInBounds && location) {
						this.#updateCacheWithRender(location, render)
					}

					if (!skipInvalidation) {
						this.emit('button_drawn', location, render)
					}
				} catch (e) {
					this.#logger.warn(`drawButtonImage failed: ${e}`)
				}
			},
			5
		) // TODO - dynamic limit

		this.#logger.info('Loading fonts')

		GlobalFonts.registerFromPath(generateFontUrl('Arimo-Regular.ttf'), 'Companion-sans')
		// typos:disable-line wdth is part of the filename
		GlobalFonts.registerFromPath(generateFontUrl('NotoSansMono-wdth-wght.ttf'), 'Companion-mono')
		GlobalFonts.registerFromPath(generateFontUrl('NotoSansSymbols-wght.ttf'), 'Companion-symbols1')
		GlobalFonts.registerFromPath(generateFontUrl('NotoSansSymbols2-Regular.ttf'), 'Companion-symbols2')
		GlobalFonts.registerFromPath(generateFontUrl('NotoSansMath-Regular.ttf'), 'Companion-symbols3')
		GlobalFonts.registerFromPath(generateFontUrl('NotoMusic-Regular.ttf'), 'Companion-symbols4')
		GlobalFonts.registerFromPath(generateFontUrl('NotoSansLinearA-Regular.ttf'), 'Companion-symbols5')
		GlobalFonts.registerFromPath(generateFontUrl('NotoSansLinearB-Regular.ttf'), 'Companion-symbols6')
		GlobalFonts.registerFromPath(generateFontUrl('NotoSansGurmukhi-Regular.ttf'), 'Companion-gurmukhi')
		GlobalFonts.registerFromPath(generateFontUrl('NotoSansSC-Regular.ttf'), 'Companion-simplified-chinese')
		GlobalFonts.registerFromPath(generateFontUrl('NotoSansKR-Regular.ttf'), 'Companion-korean')
		GlobalFonts.registerFromPath(generateFontUrl('NotoColorEmoji-compat.ttf'), 'Companion-emoji')
		GlobalFonts.registerFromPath(generateFontUrl('pf_tempesta_seven.ttf'), '5x7')

		this.#logger.info('Fonts loaded')
	}

	/**
	 * Clear all renders for the specified page, replacing with 'blank' renders
	 */
	clearAllForPage(pageNumber: number): void {
		const pageCache = this.#renderCache.get(pageNumber)
		if (!pageCache) return

		for (const [row, rowCache] of pageCache.entries()) {
			for (const column of rowCache.keys()) {
				const location: ControlLocation = {
					pageNumber,
					row,
					column,
				}

				const blankRender = GraphicsRenderer.drawBlank(this.#drawOptions, location)

				this.#updateCacheWithRender(location, blankRender)
				this.emit('button_drawn', location, blankRender)
			}
		}
	}

	/**
	 * Store a new render
	 */
	#updateCacheWithRender(location: ControlLocation, render: ImageResult): void {
		let pageCache = this.#renderCache.get(location.pageNumber)
		if (!pageCache) {
			pageCache = new Map()
			this.#renderCache.set(location.pageNumber, pageCache)
		}

		let rowCache = pageCache.get(location.row)
		if (!rowCache) {
			rowCache = new Map()
			pageCache.set(location.row, rowCache)
		}

		rowCache.set(location.column, render)
	}

	/**
	 * Redraw the page controls on every page
	 */
	invalidatePageControls(): void {
		const allControls = this.#controlsController.getAllControls()
		for (const control of Object.values(allControls)) {
			if (control.type === 'pageup' || control.type === 'pagedown') {
				this.invalidateControl(control.controlId)
			}
		}
	}

	/**
	 * Draw a preview of a button
	 */
	async drawPreview(buttonStyle: CompanionButtonStyleProps & { style: 'button' }): Promise<ImageResult> {
		const drawStyle: DrawStyleModel = {
			...buttonStyle,

			textExpression: false,

			imageBuffers: [],
			pushed: false,
			cloud: false,
			cloud_error: false,
			button_status: undefined,
			action_running: false,

			stepCurrent: 1,
			stepCount: 1,

			show_topbar: buttonStyle.show_topbar,
			alignment: buttonStyle.alignment ?? 'center:center',
			pngalignment: buttonStyle.pngalignment ?? 'center:center',
			png64: buttonStyle.png64 ?? null,
			blink: buttonStyle.blink ?? null,
			size: buttonStyle.size === 'auto' ? 'auto' : Number(buttonStyle.size),
		}

		const { buffer, width, height, dataUrl, draw_style } = await this.#executePoolDrawButtonImage(
			drawStyle,
			undefined,
			undefined,
			CRASHED_WORKER_RETRY_COUNT
		)
		return GraphicsRenderer.wrapDrawButtonImage(buffer, width, height, dataUrl, draw_style, drawStyle)
	}

	/**
	 * Process an updated userconfig value and update as necessary.
	 * @param key - the saved key
	 * @param value - the saved value
	 */
	updateUserConfig(key: string, value: boolean | number | string): void {
		if (key == 'page_direction_flipped') {
			this.#drawOptions.page_direction_flipped = !!value
			this.invalidatePageControls()
		} else if (key == 'page_plusminus') {
			this.#drawOptions.page_plusminus = !!value
			this.invalidatePageControls()
		} else if (key == 'remove_topbar') {
			this.#drawOptions.remove_topbar = !!value
			this.#logger.silly('Topbar removed')
			// Delay redrawing to give connections a chance to adjust
			setTimeout(() => {
				this.emit('resubscribeFeedbacks')
				this.regenerateAll(false)
			}, 1000)
		}
	}

	/**
	 * Regenerate the render of a control
	 */
	invalidateControl(controlId: string): void {
		const location = this.#pageStore.getLocationOfControlId(controlId)
		if (location) {
			this.invalidateButton(location)
			return
		}

		// Special case for presets as they don't have a location, but do have bitmaps
		const parsedControlId = ParseControlId(controlId)
		if (parsedControlId?.type === 'preset') {
			this.#drawAndCachePreset(controlId)
		}
	}

	/**
	 * Regenerate the render of a button at a location
	 */
	invalidateButton(location: ControlLocation): void {
		this.#drawAndCacheButton(location)
	}

	/**
	 * Regenerate every button image
	 * @param skipInvalidation whether to skip reporting invalidations of each button
	 */
	regenerateAll(skipInvalidation = false): void {
		const pageCount = this.#pageStore.getPageCount()
		for (let pageNumber = 1; pageNumber <= pageCount; pageNumber++) {
			const populatedLocations = this.#pageStore.getAllPopulatedLocationsOnPage(pageNumber)
			for (const location of populatedLocations) {
				this.#drawAndCacheButton(location, skipInvalidation)
			}
		}
	}

	/**
	 * Generate and cache
	 */
	#drawAndCacheButton(location: ControlLocation, skipInvalidation = false): void {
		const id = `${location.pageNumber}_${location.row}_${location.column}`
		this.#renderQueue.queue(id, { type: 'button', location }, skipInvalidation)
	}

	/**
	 * Generate and cache
	 */
	#drawAndCachePreset(controlId: string, skipInvalidation = false): void {
		this.#renderQueue.queue(controlId, { type: 'preset', controlId }, skipInvalidation)
	}

	/**
	 * Discard any renders for controls that are outside of the valid grid bounds
	 */
	discardAllOutOfBoundsControls(): void {
		const { minColumn, maxColumn, minRow, maxRow } = this.#userConfigController.getKey('gridSize')

		for (const page of this.#renderCache.values()) {
			for (const row of page.keys()) {
				const rowObj = page.get(row)
				if (!rowObj) continue

				if (row < minRow || row > maxRow) {
					// Row is out of bounds, delete it all
					page.delete(row)
				} else {
					for (const column of rowObj.keys()) {
						if (column < minColumn || column > maxColumn) {
							// Column is out of bounds
							rowObj.delete(column)
						}
					}
				}
			}
		}
	}

	/**
	 * Generate pincode images
	 */
	getImagesForPincode(pincode: string): PincodeBitmaps {
		if (!this.#pincodeBuffersCache) {
			this.#pincodeBuffersCache = {}

			for (let i = 0; i < 10; i++) {
				this.#pincodeBuffersCache[i] = GraphicsRenderer.drawPincodeNumber(i)
			}
		}

		return {
			...this.#pincodeBuffersCache,
			code: GraphicsRenderer.drawPincodeEntry(pincode),
		}
	}

	/**
	 * Get the cached render of a button
	 */
	getCachedRender(location: ControlLocation): ImageResult | undefined {
		return this.#renderCache.get(location.pageNumber)?.get(location.row)?.get(location.column)
	}

	/**
	 * Get the cached render of a button, or generate a placeholder it if is missing
	 */
	getCachedRenderOrGeneratePlaceholder(location: ControlLocation): ImageResult {
		const render = this.#renderCache.get(location.pageNumber)?.get(location.row)?.get(location.column)
		if (render) return render

		return GraphicsRenderer.drawBlank(this.#drawOptions, location)
	}

	/**
	 * Draw a button image in the worker pool
	 * @returns Image render object
	 */
	async #executePoolDrawButtonImage(
		drawStyle: DrawStyleModel,
		location: ControlLocation | undefined,
		pagename: string | undefined,
		remainingAttempts: number
	): Promise<{
		buffer: Buffer
		width: number
		height: number
		dataUrl: string
		draw_style: DrawStyleModel['style'] | undefined
	}> {
		return this.#poolExec('drawButtonImage', [this.#drawOptions, drawStyle, location, pagename], remainingAttempts)
	}
}

type PincodeBitmaps = {
	code: ImageResult
	[index: number]: ImageResult
}
