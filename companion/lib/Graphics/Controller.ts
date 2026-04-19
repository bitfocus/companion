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

import { EventEmitter } from 'events'
import os from 'os'
import path from 'path'
import { GlobalFonts } from '@napi-rs/canvas'
import debounceFn from 'debounce-fn'
import QuickLRU from 'quick-lru'
import workerPool from 'workerpool'
import { ParseControlId, xyToOldBankIndex } from '@companion-app/shared/ControlId.js'
import type { ControlLocation } from '@companion-app/shared/Model/Common.js'
import type { DrawStyleButtonModel, DrawStyleModel } from '@companion-app/shared/Model/StyleModel.js'
import type { VariableValues } from '@companion-app/shared/Model/Variables.js'
import { assertNever, type CompanionButtonStyleProps } from '@companion-module/base'
import type { IControlStore } from '../Controls/IControlStore.js'
import type { DataUserConfig } from '../Data/UserConfig.js'
import LogController from '../Log/Controller.js'
import type { IPageStore } from '../Page/Store.js'
import { ImageWriteQueue } from '../Resources/ImageWriteQueue.js'
import { isPackaged } from '../Resources/Util.js'
import type { VariablesValues, VariableValueEntry } from '../Variables/Values.js'
import type { ImageResult } from './ImageResult.js'
import { GraphicsRenderer } from './Renderer.js'
import { GraphicsThreadMethods } from './ThreadMethods.js'
import type { RendererButtonStyle, RendererDrawStyle } from './Types.js'

const CRASHED_WORKER_RETRY_COUNT = 10
const WORKER_TERMINATION_WINDOW_MS = 60_000 // 1 minute
const WORKER_TERMINATION_THRESHOLD = 30 // High limit, to catch extreme cases

const DEBUG_DISABLE_RENDER_THREADING = process.env.DEBUG_DISABLE_RENDER_THREADING === '1'

// LRU cache sizing parameters
const RENDER_CACHE_AVG_ACTIVE_STATES = 1.5 // Average number of frequently-used states per button
const RENDER_CACHE_PER_BUTTON_RATIO = 0.1 // Proportion of states to keep cached
const RENDER_CACHE_MIN_SIZE = 100
const RENDER_CACHE_MAX_SIZE = 1000
const RENDER_CACHE_RESIZE_DEBOUNCE_MS = 500

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
	return path.join(import.meta.dirname, fontPath, fontFilename)
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

	readonly controlsStore: IControlStore
	readonly #pageStore: IPageStore
	readonly #userConfigController: DataUserConfig
	readonly #variableValuesController: VariablesValues

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
	readonly #renderLRUCache: QuickLRU<string, ImageResult>

	readonly #renderQueue: ImageWriteQueue<string, [RenderArguments, boolean]>

	#pool = workerPool.pool(path.join(import.meta.dirname, isPackaged() ? './RenderThread.js' : './Thread.js'), {
		minWorkers: 2,
		maxWorkers: Math.max(4, Math.floor(os.cpus().length * 0.67)), // Use 2/3 of available CPUs, at least 4
		workerType: 'thread',
		onCreateWorker: () => {
			this.#logger.info('Render worker created')
			return undefined
		},
		onTerminateWorker: () => {
			this.#logger.info('Render worker terminated')
		},
	})

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

	#pendingVariables: VariableValues | null = null
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

	/**
	 * Debounced handler for resizing the render LRU cache when control count changes
	 */
	#debounceResizeRenderCache = debounceFn(
		() => {
			const newSize = this.#computeRenderCacheSize()
			const currentSize = this.#renderLRUCache.maxSize
			if (newSize !== currentSize) {
				this.#renderLRUCache.resize(newSize)
				this.#logger.debug(`Render LRU cache resized from ${currentSize} to ${newSize}`)
			}
		},
		{
			wait: RENDER_CACHE_RESIZE_DEBOUNCE_MS,
		}
	)

	constructor(
		controlsStore: IControlStore,
		pageStore: IPageStore,
		userConfigController: DataUserConfig,
		variableValuesController: VariablesValues
	) {
		super()

		this.controlsStore = controlsStore
		this.#pageStore = pageStore
		this.#userConfigController = userConfigController
		this.#variableValuesController = variableValuesController

		// Initialize render LRU cache with dynamic size based on control count
		const initialCacheSize = this.#computeRenderCacheSize()
		this.#renderLRUCache = new QuickLRU({ maxSize: initialCacheSize })
		this.#logger.debug(`Render LRU cache initialized with size ${initialCacheSize}`)

		this.setMaxListeners(0)

		this.#drawOptions = {
			page_direction_flipped: this.#userConfigController.getKey('page_direction_flipped'),
			page_plusminus: this.#userConfigController.getKey('page_plusminus'),
			remove_topbar: this.#userConfigController.getKey('remove_topbar'),
		}

		this.#renderQueue = new ImageWriteQueue(
			this.#logger,
			async (_id: string, args: RenderArguments, skipInvalidation: boolean) => {
				try {
					if (args.type === 'preset') {
						const control = this.controlsStore.getControl(args.controlId)
						const buttonStyle = control?.getDrawStyle() ?? undefined

						let render: ImageResult | undefined
						if (buttonStyle && buttonStyle.style) {
							// Check if the image is already present in the render cache and if so, return it

							const key = JSON.stringify({ options: this.#drawOptions, buttonStyle })
							render = this.#renderLRUCache.get(key)

							if (!render) {
								const { buffer, width, height, dataUrl, draw_style } = await this.#executePoolDrawButtonImage(
									{
										...(buttonStyle as DrawStyleButtonModel),
										show_topbar: this.#resolveShowTopBar((buttonStyle as DrawStyleButtonModel).show_topbar),
										location: undefined, // Presets don't have a location, and it isn't needed for rendering
									},
									CRASHED_WORKER_RETRY_COUNT
								)
								render = GraphicsRenderer.wrapDrawButtonImage(buffer, width, height, dataUrl, draw_style, buttonStyle)
								this.#renderLRUCache.set(key, render)
							}
						} else {
							render = GraphicsRenderer.drawBlank(!this.#drawOptions.remove_topbar, null)
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
					const control = controlId ? this.controlsStore.getControl(controlId) : undefined
					const buttonStyle = control?.getDrawStyle() ?? undefined

					if (location && locationIsInBounds) {
						// Update the internal b_text_1_4 variable
						setImmediate(() => {
							const values: VariableValues = {}

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

						let renderStyle: RendererDrawStyle | undefined
						switch (buttonStyle.style) {
							case 'button': {
								const showTopBar = this.#resolveShowTopBar(buttonStyle.show_topbar)

								renderStyle = {
									...buttonStyle,

									show_topbar: showTopBar,
									location: showTopBar ? location : undefined, // Only needed if the topbar is shown
								}
								break
							}
							case 'pageup':
							case 'pagedown': {
								renderStyle = {
									style: buttonStyle.style,
									plusminus: this.#drawOptions.page_plusminus,
									direction_flipped: this.#drawOptions.page_direction_flipped,
								}
								break
							}
							case 'pagenum': {
								renderStyle = {
									style: 'pagenum',
									pageNumber: location.pageNumber,
									pageName: pagename,
								}
								break
							}
							default:
								assertNever(buttonStyle)
								break
						}

						if (renderStyle) {
							// Check if the image is already present in the render cache and if so, return it
							const cacheKey = JSON.stringify(renderStyle)
							render = this.#renderLRUCache.get(cacheKey)

							if (!render) {
								const { buffer, width, height, dataUrl, draw_style } = await this.#executePoolDrawButtonImage(
									renderStyle,
									CRASHED_WORKER_RETRY_COUNT
								)
								render = GraphicsRenderer.wrapDrawButtonImage(buffer, width, height, dataUrl, draw_style, buttonStyle)
								this.#renderLRUCache.set(cacheKey, render)
							}
						} else {
							render = GraphicsRenderer.drawBlank(!this.#drawOptions.remove_topbar, location)
						}
					} else {
						render = GraphicsRenderer.drawBlank(!this.#drawOptions.remove_topbar, location)
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

				const blankRender = GraphicsRenderer.drawBlank(!this.#drawOptions.remove_topbar, location)

				this.#updateCacheWithRender(location, blankRender)
				this.emit('button_drawn', location, blankRender)
			}
		}
	}

	#resolveShowTopBar(show_topbar: DrawStyleButtonModel['show_topbar']): boolean {
		const globalShowTopBar = !this.#drawOptions.remove_topbar && show_topbar === 'default'
		return globalShowTopBar || show_topbar === true
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
		const allControls = this.controlsStore.getAllControls()
		for (const control of allControls.values()) {
			if (control.type === 'pageup' || control.type === 'pagedown') {
				this.invalidateControl(control.controlId)
			}
		}
	}

	/**
	 * Draw a preview of a button
	 */
	async drawPreview(buttonStyle: CompanionButtonStyleProps & { style: 'button' }): Promise<ImageResult> {
		const drawStyle: RendererButtonStyle = {
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

			show_topbar: this.#resolveShowTopBar(buttonStyle.show_topbar),
			alignment: buttonStyle.alignment ?? 'center:center',
			pngalignment: buttonStyle.pngalignment ?? 'center:center',
			png64: buttonStyle.png64 ?? null,
			size: buttonStyle.size === 'auto' ? 'auto' : Number(buttonStyle.size),

			location: undefined,
		}

		const { buffer, width, height, dataUrl, draw_style } = await this.#executePoolDrawButtonImage(
			drawStyle,
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

		return GraphicsRenderer.drawBlank(!this.#drawOptions.remove_topbar, location)
	}

	/**
	 * Compute the target size for the render LRU cache based on control count
	 */
	#computeRenderCacheSize(): number {
		const allControls = this.controlsStore.getAllControls()
		const totalControls = allControls.size
		const computed = Math.ceil(totalControls * RENDER_CACHE_AVG_ACTIVE_STATES * RENDER_CACHE_PER_BUTTON_RATIO)
		return Math.max(RENDER_CACHE_MIN_SIZE, Math.min(computed, RENDER_CACHE_MAX_SIZE))
	}

	/**
	 * Trigger a debounced resize of the render LRU cache (called when controls are added/removed)
	 */
	triggerCacheResize(): void {
		this.#debounceResizeRenderCache()
	}

	/**
	 * Draw a button image in the worker pool
	 * @returns Image render object
	 */
	async #executePoolDrawButtonImage(
		drawStyle: RendererDrawStyle,
		remainingAttempts: number
	): Promise<{
		buffer: Buffer
		width: number
		height: number
		dataUrl: string
		draw_style: DrawStyleModel['style'] | undefined
	}> {
		return this.#poolExec('drawButtonImage', [drawStyle], remainingAttempts)
	}
}
