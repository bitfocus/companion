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

import QuickLRU from 'quick-lru'
import { GlobalFonts } from '@napi-rs/canvas'
import { GraphicsRenderer } from './Renderer.js'
import { ParseControlId, xyToOldBankIndex } from '@companion-app/shared/ControlId.js'
import { ImageResult, type ImageResultProcessedStyle } from './ImageResult.js'
import { ImageWriteQueue } from '../Resources/ImageWriteQueue.js'
import workerPool from 'workerpool'
import { isPackaged } from '../Resources/Util.js'
import { fileURLToPath } from 'url'
import os from 'os'
import debounceFn from 'debounce-fn'
import type { VariableValues } from '@companion-app/shared/Model/Variables.js'
import {
	ButtonGraphicsDecorationType,
	type DrawImageBuffer,
	type DrawStyleModel,
} from '@companion-app/shared/Model/StyleModel.js'
import type { ControlLocation } from '@companion-app/shared/Model/Common.js'
import { EventEmitter } from 'events'
import LogController from '../Log/Controller.js'
import type { DataUserConfig } from '../Data/UserConfig.js'
import type { IPageStore } from '../Page/Store.js'
import type { ControlsController } from '../Controls/Controller.js'
import type { VariablesController } from '../Variables/Controller.js'
import type { VariablesValues, VariableValueEntry } from '../Variables/Values.js'
import type { GraphicsOptions } from '@companion-app/shared/Graphics/Util.js'
import { FONT_DEFINITIONS } from './Fonts.js'
import type Express from 'express'
import compressionMiddleware from 'compression'
import fs from 'fs'
import type { SurfaceRotation } from '@companion-app/shared/Model/Surfaces.js'
import type * as imageRs from '@julusian/image-rs'
import type { DataDatabase } from '../Data/Database.js'
import { ImageLibrary } from './ImageLibrary.js'
import { GraphicsThreadMethods } from './ThreadMethods.js'
import type { SomeButtonGraphicsDrawElement } from '@companion-app/shared/Model/StyleLayersModel.js'
import { collectContentHashes } from './ConvertGraphicsElements/Util.js'

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

	/**
	 * Image library for storing and managing images
	 */
	readonly imageLibrary: ImageLibrary

	#pool = workerPool.pool(
		// note: import.meta.url can be replaced with import.meta.directory as long as we use node v22.16 and later
		fileURLToPath(new URL(isPackaged() ? './RenderThread.js' : './Thread.js', import.meta.url)),
		{
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
		controlsController: ControlsController,
		pageStore: IPageStore,
		userConfigController: DataUserConfig,
		variablesController: VariablesController,
		db: DataDatabase,
		internalApiRouter: Express.Router
	) {
		super()

		this.#controlsController = controlsController
		this.#pageStore = pageStore
		this.#userConfigController = userConfigController
		this.#variableValuesController = variablesController.values

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
						const control = this.#controlsController.getControl(args.controlId)
						const buttonStyle = (await control?.getDrawStyle()) ?? undefined

						let render: ImageResult | undefined
						if (buttonStyle && buttonStyle.style === 'button-layered') {
							// Check if the image is already present in the render cache and if so, return it
							// Use collected contentHashes instead of JSON.stringify on entire buttonStyle to avoid
							// serializing large binary data (images can be 100KB+)
							const key = JSON.stringify({
								options: this.#drawOptions,
								...buttonStyle,
								elements: collectContentHashes(buttonStyle.elements),
							})
							render = this.#renderLRUCache.get(key)

							if (!render) {
								const { dataUrl, processedStyle } = await this.#executePoolDrawButtonImage(
									buttonStyle,
									undefined,
									undefined,
									CRASHED_WORKER_RETRY_COUNT
								)
								render = new ImageResult(dataUrl, processedStyle, async (width, height, rotation, format) =>
									this.#executePoolDrawButtonBareImage(
										buttonStyle,
										undefined,
										undefined,
										{ width, height, oversampling: 4 }, // TODO - dynamic oversampling?
										rotation,
										format,
										CRASHED_WORKER_RETRY_COUNT
									)
								)
								this.#renderLRUCache.set(key, render)
							}
						} else {
							render = GraphicsRenderer.drawBlank({ width: 72, height: 72 }, this.#drawOptions, null)
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
					const buttonStyle = (await control?.getDrawStyle()) ?? undefined

					let render: ImageResult | undefined
					if (location && locationIsInBounds && buttonStyle && buttonStyle.style) {
						const pagename = this.#pageStore.getPageName(location.pageNumber)

						// Check if the image is already present in the render cache and if so, return it
						let keyLocation: ControlLocation | undefined
						if (buttonStyle.style === 'button-layered') {
							const canvasElement = buttonStyle.elements.find((el) => el.type === 'canvas')

							const globalShowTopBar =
								!this.#drawOptions.remove_topbar &&
								canvasElement?.decoration === ButtonGraphicsDecorationType.FollowDefault
							keyLocation =
								globalShowTopBar || canvasElement?.decoration === ButtonGraphicsDecorationType.TopBar
									? location
									: undefined
						}
						const key =
							buttonStyle.style === 'button-layered'
								? JSON.stringify({
										options: this.#drawOptions,
										...buttonStyle,
										elements: collectContentHashes(buttonStyle.elements),
										keyLocation,
										pagename,
									})
								: JSON.stringify({ options: this.#drawOptions, buttonStyle, keyLocation, pagename })
						render = this.#renderLRUCache.get(key)

						if (!render) {
							const { dataUrl, processedStyle } = await this.#executePoolDrawButtonImage(
								buttonStyle,
								location,
								pagename,
								CRASHED_WORKER_RETRY_COUNT
							)
							render = new ImageResult(dataUrl, processedStyle, async (width, height, rotation, format) =>
								this.#executePoolDrawButtonBareImage(
									buttonStyle,
									location,
									pagename,
									{ width, height, oversampling: 4 }, // TODO - dynamic oversampling?
									rotation,
									format,
									CRASHED_WORKER_RETRY_COUNT
								)
							)
							this.#renderLRUCache.set(key, render)
						}
					} else {
						render = GraphicsRenderer.drawBlank({ width: 72, height: 72 }, this.#drawOptions, location)
					}

					if (location && locationIsInBounds) {
						// Update the internal b_text_1_4 variable
						setImmediate(() => {
							const values: VariableValues = {}

							// Update text, if it is present
							values[`b_text_${location.pageNumber}_${location.row}_${location.column}`] = render
								? render.style?.text?.text
								: undefined
							const bankIndex = xyToOldBankIndex(location.column, location.row)
							if (bankIndex)
								values[`b_text_${location.pageNumber}_${bankIndex}`] = render ? render.style?.text?.text : undefined

							values[`b_pushed_${location.pageNumber}_${location.row}_${location.column}`] =
								buttonStyle?.style === 'button-layered' ? buttonStyle.pushed : undefined

							// Update step
							values[`b_step_${location.pageNumber}_${location.row}_${location.column}`] =
								buttonStyle?.style === 'button-layered' ? buttonStyle.stepCurrent : undefined
							values[`b_step_count_${location.pageNumber}_${location.row}_${location.column}`] =
								buttonStyle?.style === 'button-layered' ? buttonStyle.stepCount : undefined

							values[`b_actions_running_${location.pageNumber}_${location.row}_${location.column}`] =
								buttonStyle?.style === 'button-layered' ? (buttonStyle.action_running ?? false) : undefined

							values[`b_status_${location.pageNumber}_${location.row}_${location.column}`] =
								buttonStyle?.style === 'button-layered' ? (buttonStyle.button_status ?? 'good') : undefined
							// Submit the updated values
							if (this.#pendingVariables) {
								Object.assign(this.#pendingVariables, values)
							} else {
								this.#pendingVariables = values
							}
							this.#debouncePendingVariables()
						})
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

		for (const definition of FONT_DEFINITIONS) {
			GlobalFonts.registerFromPath(definition.pathOnDisk, definition.name)
		}

		this.#logger.info('Fonts loaded')

		// Initialize the image library
		this.imageLibrary = new ImageLibrary(db, this, variablesController)

		// Serve font files to clients
		internalApiRouter.get('/graphics/font/:font', compressionMiddleware(), (req, res) => {
			const definition = FONT_DEFINITIONS.find((def) => def.name === req.params.font)
			if (!definition) {
				res.status(404).send('Font not found')
				return
			}

			// Try and set the correct content type
			if (definition.pathOnDisk.endsWith('.ttf')) {
				res.setHeader('Content-Type', 'font/ttf')
			}

			// Cache aggressively
			res.setHeader('Cache-Control', 'public, max-age=31536000')

			this.#logger.debug(`Send font ${definition.name}`)
			fs.createReadStream(definition.pathOnDisk).pipe(res)
		})
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

				const blankRender = GraphicsRenderer.drawBlank({ width: 72, height: 72 }, this.#drawOptions, location)

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
	async drawPreview(elements: SomeButtonGraphicsDrawElement[]): Promise<ImageResult> {
		const drawStyle: DrawStyleModel = {
			style: 'button-layered',

			elements: elements,

			pushed: false,
			button_status: undefined,
			action_running: false,

			stepCurrent: 1,
			stepCount: 1,
		}

		const { dataUrl, processedStyle } = await this.#executePoolDrawButtonImage(
			drawStyle,
			undefined,
			undefined,
			CRASHED_WORKER_RETRY_COUNT
		)
		return new ImageResult(dataUrl, processedStyle, async (width, height, rotation, format) =>
			this.#executePoolDrawButtonBareImage(
				drawStyle,
				undefined,
				undefined,
				{ width, height, oversampling: 4 }, // TODO - dynamic oversampling?
				rotation,
				format,
				CRASHED_WORKER_RETRY_COUNT
			)
		)
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

		return GraphicsRenderer.drawBlank({ width: 72, height: 72 }, this.#drawOptions, location)
	}

	/**
	 * Compute the target size for the render LRU cache based on control count
	 */
	#computeRenderCacheSize(): number {
		const allControls = this.#controlsController.getAllControls()
		const totalControls = Object.keys(allControls).length
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
		drawStyle: DrawStyleModel,
		location: ControlLocation | undefined,
		pagename: string | undefined,
		remainingAttempts: number
	): Promise<{
		dataUrl: string
		processedStyle: ImageResultProcessedStyle
	}> {
		return this.#poolExec('drawButtonImage', [this.#drawOptions, drawStyle, location, pagename], remainingAttempts)
	}

	/**
	 * Draw a button image in the worker pool
	 * @returns Image render object
	 */
	async #executePoolDrawButtonBareImage(
		drawStyle: DrawStyleModel,
		location: ControlLocation | undefined,
		pagename: string | undefined,
		resolution: { width: number; height: number; oversampling: number },
		rotation: SurfaceRotation | null,
		format: imageRs.PixelFormat,
		remainingAttempts: number
	): Promise<Uint8Array> {
		return this.#poolExec(
			'drawButtonBareImage',
			[this.#drawOptions, drawStyle, location, pagename, resolution, rotation, format],
			remainingAttempts
		)
	}

	/**
	 * Create a preview image in the worker pool
	 */
	async executeCreatePreview(
		originalDataUrl: string,
		remainingAttempts: number = CRASHED_WORKER_RETRY_COUNT
	): Promise<{ width: number; height: number; previewDataUrl: string }> {
		return this.#poolExec('createImagePreview', [originalDataUrl], remainingAttempts)
	}

	async renderPixelBuffers(
		imageBuffers: DrawImageBuffer[],
		remainingAttempts: number = CRASHED_WORKER_RETRY_COUNT
	): Promise<string | undefined> {
		if (imageBuffers.length === 0) return undefined

		return this.#poolExec('drawImageBuffers', [true, imageBuffers], remainingAttempts)
	}
}
