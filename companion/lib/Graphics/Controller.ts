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
import { xyToOldBankIndex } from '@companion-app/shared/ControlId.js'
import { ImageResult, ImageResultProcessedStyle } from './ImageResult.js'
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
import type { GraphicsOptions } from '@companion-app/shared/Graphics/Util.js'
import { FONT_DEFINITIONS } from './Fonts.js'
import type Express from 'express'
import compressionMiddleware from 'compression'
import fs from 'fs'
import type { SurfaceRotation } from '@companion-app/shared/Model/Surfaces.js'
import type imageRs from '@julusian/image-rs'

const CRASHED_WORKER_RETRY_COUNT = 10

const DEBUG_DISABLE_RENDER_THREADING = process.env.DEBUG_DISABLE_RENDER_THREADING === '1'

interface GraphicsControllerEvents {
	button_drawn: [location: ControlLocation, render: ImageResult]
	resubscribeFeedbacks: []
}

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
	readonly #renderLRUCache = new LRUCache<string, ImageResult>({ max: 100 })

	readonly #renderQueue: ImageWriteQueue<string, [ControlLocation, boolean]>

	#pool = workerPool.pool(
		isPackaged() ? path.join(__dirname, './RenderThread.js') : fileURLToPath(new URL('./Thread.js', import.meta.url)),
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
		variableValuesController: VariablesValues,
		internalApiRouter: Express.Router
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
			async (_id: string, location: ControlLocation, skipInvalidation: boolean) => {
				try {
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

							values[`b_pushed_${location.pageNumber}_${location.row}_${location.column}`] =
								buttonStyle?.style === 'button' || buttonStyle?.style === 'button-layered'
									? buttonStyle.pushed
									: undefined

							// Update step
							values[`b_step_${location.pageNumber}_${location.row}_${location.column}`] =
								buttonStyle?.style === 'button' || buttonStyle?.style === 'button-layered'
									? buttonStyle.stepCurrent
									: undefined
							values[`b_step_count_${location.pageNumber}_${location.row}_${location.column}`] =
								buttonStyle?.style === 'button' || buttonStyle?.style === 'button-layered'
									? buttonStyle.stepCount
									: undefined

							values[`b_actions_running_${location.pageNumber}_${location.row}_${location.column}`] =
								buttonStyle?.style === 'button' || buttonStyle?.style === 'button-layered'
									? (buttonStyle.action_running ?? false)
									: undefined

							values[`b_status_${location.pageNumber}_${location.row}_${location.column}`] =
								buttonStyle?.style === 'button' || buttonStyle?.style === 'button-layered'
									? (buttonStyle.button_status ?? 'good')
									: undefined
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

						// Check if the image is already present in the render cache and if so, return it
						let keyLocation: ControlLocation | undefined
						if (buttonStyle.style === 'button') {
							const globalShowTopBar = !this.#drawOptions.remove_topbar && buttonStyle.show_topbar === 'default'
							keyLocation = globalShowTopBar || buttonStyle.show_topbar === true ? location : undefined
						}
						const key = JSON.stringify({ options: this.#drawOptions, buttonStyle, keyLocation, pagename })
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
						}
					} else {
						render = GraphicsRenderer.drawBlank({ width: 72, height: 72 }, this.#drawOptions, location)
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
			size: buttonStyle.size === 'auto' ? 'auto' : Number(buttonStyle.size),
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
		this.#renderQueue.queue(id, location, skipInvalidation)
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
	getPincodeNumberImages(width: number, height: number): PincodeBitmaps {
		const pincodeBuffersCache: PincodeBitmaps = {}

		for (let i = 0; i <= 9; i++) {
			pincodeBuffersCache[i] = GraphicsRenderer.drawPincodeNumber(width, height, i)
		}

		return pincodeBuffersCache
	}

	getPincodeCodeImage(width: number, height: number, pincode: string): ImageResult {
		return GraphicsRenderer.drawPincodeEntry(width, height, pincode)
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
		const args: Parameters<typeof GraphicsRenderer.drawButtonImageUnwrapped> = [
			this.#drawOptions,
			drawStyle,
			location,
			pagename,
		]

		if (DEBUG_DISABLE_RENDER_THREADING) {
			return GraphicsRenderer.drawButtonImageUnwrapped(...args)
		}

		try {
			return this.#pool.exec('drawButtonImage', args)
		} catch (e: any) {
			// if a worker crashes, the first attempt will fail, retry when that happens, but not infinitely
			if (remainingAttempts > 1 && e?.message?.includes('Worker is terminated')) {
				return this.#executePoolDrawButtonImage(drawStyle, location, pagename, remainingAttempts - 1)
			} else {
				throw e
			}
		}
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
		const args: Parameters<typeof GraphicsRenderer.drawButtonBareImageUnwrapped> = [
			this.#drawOptions,
			drawStyle,
			location,
			pagename,
			resolution,
			rotation,
			format,
		]

		if (DEBUG_DISABLE_RENDER_THREADING) {
			return GraphicsRenderer.drawButtonBareImageUnwrapped(...args)
		}

		try {
			return this.#pool.exec('drawButtonBareImage', args)
		} catch (e: any) {
			// if a worker crashes, the first attempt will fail, retry when that happens, but not infinitely
			if (remainingAttempts > 1 && e?.message?.includes('Worker is terminated')) {
				return this.#executePoolDrawButtonBareImage(
					drawStyle,
					location,
					pagename,
					resolution,
					rotation,
					format,
					remainingAttempts - 1
				)
			} else {
				throw e
			}
		}
	}
}

export type PincodeBitmaps = {
	[index: number]: ImageResult
}
