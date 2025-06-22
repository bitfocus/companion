import { EmberServer, Model as EmberModel } from 'emberplus-connection'
// eslint-disable-next-line n/no-missing-import
import { getPath } from 'emberplus-connection/dist/Ember/Lib/util.js'
import { ServiceBase } from './Base.js'
import { formatLocation, oldBankIndexToXY, xyToOldBankIndex } from '@companion-app/shared/ControlId.js'
import { pad } from '@companion-app/shared/Util.js'
import { parseColorToNumber } from '../Resources/Util.js'
import { LEGACY_MAX_BUTTONS } from '../Resources/Constants.js'
import type { UserConfigGridSize } from '@companion-app/shared/Model/UserConfigModel.js'
// eslint-disable-next-line n/no-missing-import
import type { EmberValue } from 'emberplus-connection/dist/types/types.js'
import type { ImageResult } from '../Graphics/ImageResult.js'
import type { ControlLocation } from '@companion-app/shared/Model/Common.js'
import type { ServiceApi } from './ServiceApi.js'
import type { DataUserConfig } from '../Data/UserConfig.js'
import type { PageController } from '../Page/Controller.js'

// const LOCATION_NODE_CONTROLID = 0
const LOCATION_NODE_PRESSED = 1
const LOCATION_NODE_TEXT = 2
const LOCATION_NODE_TEXT_COLOR = 3
const LOCATION_NODE_BG_COLOR = 4

const LEGACY_NODE_STATE = 0
const LEGACY_NODE_TEXT = 1
const LEGACY_NODE_TEXT_COLOR = 2
const LEGACY_NODE_BG_COLOR = 3

/**
 * Generate ember+ path
 */
function buildPathForLocation(gridSize: UserConfigGridSize, location: ControlLocation, node: number): string {
	const row = location.row - gridSize.minRow
	const column = location.column - gridSize.minColumn
	return `0.2.${location.pageNumber}.${row}.${column}.${node}`
}

/**
 * Generate ember+ path
 */
function buildPathForButton(page: number, bank: number, node: number): string {
	return `0.1.${page}.${bank}.${node}`
}
/**
 * Convert internal color to hex
 */
function formatColorAsHex(color: any): string {
	const newColor = parseColorToNumber(color)
	if (newColor === false) return '#000000'
	return `#${pad(newColor.toString(16).slice(-6), '0', 6)}`
}
/**
 * Parse hex color as number
 */
function parseHexColor(hex: string): number {
	return parseInt(hex.slice(1, 7), 16)
}

/**
 * Class providing the Ember+ api.
 *
 * @author Balte de Wit <contact@balte.nl>
 * @author Håkon Nessjøen <haakon@bitfocus.io>
 * @author Keith Rocheck <keith.rocheck@gmail.com>
 * @author William Viker <william@bitfocus.io>
 * @author Julian Waller <me@julusian.co.uk>
 * @since 2.1.1
 * @copyright 2022 Bitfocus AS
 * @license
 * This program is free software.
 * You should have received a copy of the MIT licence as well as the Bitfocus
 * Individual Contributor License Agreement for Companion along with
 * this program.
 */
export class ServiceEmberPlus extends ServiceBase {
	readonly #serviceApi: ServiceApi
	readonly #pageController: PageController

	#server: EmberServer | undefined = undefined

	/**
	 * Bank state array
	 */
	#pushedButtons = new Set<string>()

	constructor(serviceApi: ServiceApi, userconfig: DataUserConfig, pageController: PageController) {
		super(userconfig, 'Service/EmberPlus', 'emberplus_enabled', null)

		this.#serviceApi = serviceApi
		this.#pageController = pageController

		this.port = 9092

		this.#pageController.on('pagecount', this.#pageCountChange.bind(this))

		this.init()
	}

	/**
	 * Close the socket before deleting it
	 */
	protected close(): void {
		if (this.#server) {
			this.#server.discard()
			this.#server = undefined
		}
	}

	/**
	 * Get the page/bank structure in EmberModel form
	 */
	#getPagesTree(): Record<number, EmberModel.NumberedTreeNodeImpl<any>> {
		const output: Record<number, EmberModel.NumberedTreeNodeImpl<any>> = {}

		const pageCount = this.#pageController.getPageCount() // TODO - handle resize

		for (let pageNumber = 1; pageNumber <= pageCount; pageNumber++) {
			const children: Record<number, EmberModel.NumberedTreeNodeImpl<any>> = {}
			for (let bank = 1; bank <= LEGACY_MAX_BUTTONS; bank++) {
				const xy = oldBankIndexToXY(bank)
				const drawStyle = xy && this.#serviceApi.getCachedRender({ pageNumber, column: xy[0], row: xy[1] })?.style

				children[bank] = new EmberModel.NumberedTreeNodeImpl(
					bank,
					new EmberModel.EmberNodeImpl(`Button ${pageNumber}.${bank}`),
					{
						[LEGACY_NODE_STATE]: new EmberModel.NumberedTreeNodeImpl(
							LEGACY_NODE_STATE,
							new EmberModel.ParameterImpl(
								EmberModel.ParameterType.Boolean,
								'State',
								undefined,
								this.#pushedButtons.has(`${pageNumber}_${bank}`),
								undefined,
								undefined,
								EmberModel.ParameterAccess.ReadWrite
							)
						),
						[LEGACY_NODE_TEXT]: new EmberModel.NumberedTreeNodeImpl(
							LEGACY_NODE_TEXT,
							new EmberModel.ParameterImpl(
								EmberModel.ParameterType.String,
								'Label',
								undefined,
								drawStyle?.text?.text || '',
								undefined,
								undefined,
								EmberModel.ParameterAccess.ReadWrite
							)
						),
						[LEGACY_NODE_TEXT_COLOR]: new EmberModel.NumberedTreeNodeImpl(
							LEGACY_NODE_TEXT_COLOR,
							new EmberModel.ParameterImpl(
								EmberModel.ParameterType.String,
								'Text_Color',
								undefined,
								formatColorAsHex(drawStyle?.text?.color || 0),
								undefined,
								undefined,
								EmberModel.ParameterAccess.ReadWrite
							)
						),
						[LEGACY_NODE_BG_COLOR]: new EmberModel.NumberedTreeNodeImpl(
							LEGACY_NODE_BG_COLOR,
							new EmberModel.ParameterImpl(
								EmberModel.ParameterType.String,
								'Background_Color',
								undefined,
								formatColorAsHex(drawStyle?.color?.color || 0),
								undefined,
								undefined,
								EmberModel.ParameterAccess.ReadWrite
							)
						),
					}
				)
			}

			const pageName = this.#pageController.getPageName(pageNumber)
			output[pageNumber] = new EmberModel.NumberedTreeNodeImpl(
				pageNumber,
				new EmberModel.EmberNodeImpl(!pageName || pageName === 'PAGE' ? 'Page ' + pageNumber : pageName),
				children
			)
		}

		return output
	}

	/**
	 * Get the locations (page/row/column) structure in EmberModel form
	 */
	#getLocationTree(): Record<number, EmberModel.NumberedTreeNodeImpl<any>> {
		const gridSize: UserConfigGridSize = this.userconfig.getKey('gridSize')
		if (!gridSize) return {}

		const rowCount = gridSize.maxRow - gridSize.minRow + 1
		const columnCount = gridSize.maxColumn - gridSize.minColumn + 1

		const output: Record<number, EmberModel.NumberedTreeNodeImpl<any>> = {}

		const pageCount = this.#pageController.getPageCount() // TODO - handle resize

		for (let pageNumber = 1; pageNumber <= pageCount; pageNumber++) {
			// TODO - the numbers won't be stable  when resizing the `min` grid values

			const pageRows: Record<number, EmberModel.NumberedTreeNodeImpl<any>> = {}
			for (let rowI = 0; rowI < rowCount; rowI++) {
				const row = gridSize.minRow + rowI
				const rowColumns: Record<number, EmberModel.NumberedTreeNodeImpl<any>> = {}

				for (let colI = 0; colI < columnCount; colI++) {
					const column = gridSize.minColumn + colI

					const location: ControlLocation = {
						pageNumber,
						row,
						column,
					}

					const drawStyle = this.#serviceApi.getCachedRender(location)?.style

					rowColumns[colI] = new EmberModel.NumberedTreeNodeImpl(
						colI,
						new EmberModel.EmberNodeImpl(`Column ${column}`),
						{
							// [LOCATION_NODE_CONTROLID]: new EmberModel.NumberedTreeNodeImpl(
							// 	LOCATION_NODE_CONTROLID,
							// 	new EmberModel.ParameterImpl(EmberModel.ParameterType.String, 'Control ID', undefined, controlId ?? '')
							// ),
							[LOCATION_NODE_PRESSED]: new EmberModel.NumberedTreeNodeImpl(
								LOCATION_NODE_PRESSED,
								new EmberModel.ParameterImpl(
									EmberModel.ParameterType.Boolean,
									'Pressed',
									undefined,
									this.#pushedButtons.has(formatLocation(location)),
									undefined,
									undefined,
									EmberModel.ParameterAccess.ReadWrite
								)
							),
							[LOCATION_NODE_TEXT]: new EmberModel.NumberedTreeNodeImpl(
								LOCATION_NODE_TEXT,
								new EmberModel.ParameterImpl(
									EmberModel.ParameterType.String,
									'Label',
									undefined,
									drawStyle?.text?.text || '',
									undefined,
									undefined,
									EmberModel.ParameterAccess.ReadWrite
								)
							),
							[LOCATION_NODE_TEXT_COLOR]: new EmberModel.NumberedTreeNodeImpl(
								LOCATION_NODE_TEXT_COLOR,
								new EmberModel.ParameterImpl(
									EmberModel.ParameterType.String,
									'Text_Color',
									undefined,
									formatColorAsHex(drawStyle?.text?.color || 0),
									undefined,
									undefined,
									EmberModel.ParameterAccess.ReadWrite
								)
							),
							[LOCATION_NODE_BG_COLOR]: new EmberModel.NumberedTreeNodeImpl(
								LOCATION_NODE_BG_COLOR,
								new EmberModel.ParameterImpl(
									EmberModel.ParameterType.String,
									'Background_Color',
									undefined,
									formatColorAsHex(drawStyle?.color?.color || 0),
									undefined,
									undefined,
									EmberModel.ParameterAccess.ReadWrite
								)
							),
						}
					)
				}

				pageRows[rowI] = new EmberModel.NumberedTreeNodeImpl(
					rowI,
					new EmberModel.EmberNodeImpl(`Row ${row}`),
					rowColumns
				)
			}

			const pageName = this.#pageController.getPageName(pageNumber)
			output[pageNumber] = new EmberModel.NumberedTreeNodeImpl(
				pageNumber,
				new EmberModel.EmberNodeImpl(!pageName || pageName === 'PAGE' ? 'Page ' + pageNumber : pageName),
				pageRows
			)
		}

		return output
	}

	/**
	 * Start the service if it is not already running
	 */
	protected listen(): void {
		if (this.portConfig) {
			this.port = this.userconfig.getKey(this.portConfig)
		}
		if (this.#server !== undefined) {
			this.close()
		}

		try {
			const root = {
				0: new EmberModel.NumberedTreeNodeImpl(0, new EmberModel.EmberNodeImpl('Companion Tree'), {
					0: new EmberModel.NumberedTreeNodeImpl(0, new EmberModel.EmberNodeImpl('identity'), {
						0: new EmberModel.NumberedTreeNodeImpl(
							0,
							new EmberModel.ParameterImpl(EmberModel.ParameterType.String, 'product', undefined, 'Companion')
						),
						1: new EmberModel.NumberedTreeNodeImpl(
							1,
							new EmberModel.ParameterImpl(EmberModel.ParameterType.String, 'company', undefined, 'Bitfocus AS')
						),
						2: new EmberModel.NumberedTreeNodeImpl(
							2,
							new EmberModel.ParameterImpl(
								EmberModel.ParameterType.String,
								'version',
								undefined,
								this.#serviceApi.appInfo.appVersion
							)
						),
						3: new EmberModel.NumberedTreeNodeImpl(
							3,
							new EmberModel.ParameterImpl(
								EmberModel.ParameterType.String,
								'build',
								undefined,
								this.#serviceApi.appInfo.appBuild
							)
						),
					}),
					1: new EmberModel.NumberedTreeNodeImpl(1, new EmberModel.EmberNodeImpl('pages'), this.#getPagesTree()),
					2: new EmberModel.NumberedTreeNodeImpl(2, new EmberModel.EmberNodeImpl('location'), this.#getLocationTree()),
				}),
			}

			this.#server = new EmberServer(this.port)
			this.#server.on('error', this.handleSocketError.bind(this))
			this.#server.onSetValue = this.setValue.bind(this)

			this.#server
				.init(root)
				.then(() => {
					this.logger.info('Listening on port ' + this.port)
				})
				.catch((e: any) => {
					this.logger.error(`Could not launch: ${e.message}`)
					this.#server = undefined
					this.currentState = false
				})

			this.currentState = true
		} catch (e: any) {
			this.logger.error(`Could not launch: ${e.message}`)
		}
	}

	/**
	 * Process a received command
	 * @param parameter - the raw path
	 * @param value - the new value
	 * @returns <code>true</code> if the command was successfully parsed
	 */
	async setValue(parameter: EmberModel.NumberedTreeNodeImpl<any>, value: EmberValue): Promise<boolean> {
		const path = getPath(parameter)

		const pathInfo = path.split('.')
		// Check in the pages tree
		if (pathInfo[0] === '0' && pathInfo[1] === '1' && pathInfo.length === 5) {
			const page = parseInt(pathInfo[2])
			const bank = parseInt(pathInfo[3])
			const node = parseInt(pathInfo[4])

			if (isNaN(page) || isNaN(bank) || isNaN(node)) return false

			const controlId = this.#pageController.getControlIdAtOldBankIndex(page, bank)
			if (!controlId) return false

			switch (node) {
				case LEGACY_NODE_STATE: {
					this.logger.silly(`Change button ${controlId} pressed to ${value}`)

					this.#serviceApi.pressControl(controlId, !!value, `emberplus`)
					this.#server?.update(parameter, { value })
					return true
				}
				case LEGACY_NODE_TEXT: {
					this.logger.silly(`Change button ${controlId} text to ${value}`)

					const control = this.#serviceApi.getControl(controlId)
					if (control && control.setStyleFields) {
						control.setStyleFields({ text: String(value) })

						// Note: this will be replaced shortly after with the value with feedbacks applied
						this.#server?.update(parameter, { value })
						return true
					}
					return false
				}
				case LEGACY_NODE_TEXT_COLOR: {
					const color = parseHexColor(value + '')
					this.logger.silly(`Change button ${controlId} text color to ${value} (${color})`)

					const control = this.#serviceApi.getControl(controlId)
					if (control && control.setStyleFields) {
						control.setStyleFields({ color: color })

						// Note: this will be replaced shortly after with the value with feedbacks applied
						this.#server?.update(parameter, { value })
						return true
					}
					return false
				}
				case LEGACY_NODE_BG_COLOR: {
					const color = parseHexColor(value + '')
					this.logger.silly(`Change bank ${controlId} background color to ${value} (${color})`)

					const control = this.#serviceApi.getControl(controlId)
					if (control && control.setStyleFields) {
						control.setStyleFields({ bgcolor: color })

						// Note: this will be replaced shortly after with the value with feedbacks applied
						this.#server?.update(parameter, { value })
						return true
					}
					return false
				}
			}
		} else if (pathInfo[0] === '0' && pathInfo[1] === '2' && pathInfo.length === 6) {
			const pageNumber = parseInt(pathInfo[2])
			const row = parseInt(pathInfo[3])
			const column = parseInt(pathInfo[4])
			const node = parseInt(pathInfo[5])

			if (isNaN(pageNumber) || isNaN(row) || isNaN(column) || isNaN(node)) return false

			const controlId = this.#pageController.getControlIdAt({
				pageNumber,
				row,
				column,
			})
			if (!controlId) return false

			switch (node) {
				case LOCATION_NODE_PRESSED: {
					this.logger.silly(`Change bank ${controlId} pressed to ${value}`)

					this.#serviceApi.pressControl(controlId, !!value, `emberplus`)
					this.#server?.update(parameter, { value })
					return true
				}
				case LOCATION_NODE_TEXT: {
					this.logger.silly(`Change bank ${controlId} text to ${value}`)

					const control = this.#serviceApi.getControl(controlId)
					if (control && control.setStyleFields) {
						control.setStyleFields({ text: String(value) })

						// Note: this will be replaced shortly after with the value with feedbacks applied
						this.#server?.update(parameter, { value })
						return true
					}
					return false
				}
				case LOCATION_NODE_TEXT_COLOR: {
					const color = parseHexColor(value + '')
					this.logger.silly(`Change bank ${controlId} text color to ${value} (${color})`)

					const control = this.#serviceApi.getControl(controlId)
					if (control && control.setStyleFields) {
						control.setStyleFields({ color: color })

						// Note: this will be replaced shortly after with the value with feedbacks applied
						this.#server?.update(parameter, { value })
						return true
					}
					return false
				}
				case LOCATION_NODE_BG_COLOR: {
					const color = parseHexColor(value + '')
					this.logger.silly(`Change button ${controlId} background color to ${value} (${color})`)

					const control = this.#serviceApi.getControl(controlId)
					if (control && control.setStyleFields) {
						control.setStyleFields({ bgcolor: color })

						// Note: this will be replaced shortly after with the value with feedbacks applied
						this.#server?.update(parameter, { value })
						return true
					}
					return false
				}
			}
		}

		return false
	}

	/**
	 * Update the tree from the pageCount changing
	 */
	#pageCountChange(_pageCount: number): void {
		// TODO: This is excessive, but further research is needed to figure out how to edit the ember tree structure
		this.restartModule()
	}

	/**
	 * Send the latest bank state to the page/bank indicated
	 * @param location - the location of the control
	 * @param pushed - the state
	 * @param checks the <code>surfaceId</code> to ensure that Ember+ doesn't loop its own state change back
	 */
	updateButtonState(location: ControlLocation, pushed: boolean, surfaceId: string | undefined): void {
		if (!this.#server) return
		if (surfaceId === 'emberplus') return

		const bank = xyToOldBankIndex(location.column, location.row)

		const locationId = `${location.pageNumber}_${bank}`
		if (pushed && bank) {
			this.#pushedButtons.add(locationId)
			this.#pushedButtons.add(formatLocation(location))
		} else {
			this.#pushedButtons.delete(locationId)
			this.#pushedButtons.delete(formatLocation(location))
		}

		if (bank === null) return

		this.#updateNodePath(buildPathForButton(location.pageNumber, bank, LEGACY_NODE_STATE), pushed)
	}

	/**
	 * Send the latest bank text to the page/bank indicated
	 */
	onButtonDrawn(location: ControlLocation, render: ImageResult): void {
		if (!this.#server) return
		//this.logger.info(`Updating ${page}.${bank} label ${this.banks[page][bank].text}`)

		const style = render.style

		// New 'location' path
		const gridSize = this.userconfig.getKey('gridSize')
		if (gridSize) {
			this.#updateNodePath(buildPathForLocation(gridSize, location, LOCATION_NODE_TEXT), style?.text?.text || '')
			this.#updateNodePath(
				buildPathForLocation(gridSize, location, LOCATION_NODE_TEXT_COLOR),
				formatColorAsHex(style.text?.color || 0)
			)
			this.#updateNodePath(
				buildPathForLocation(gridSize, location, LOCATION_NODE_BG_COLOR),
				formatColorAsHex(style.color?.color || 0)
			)
		}

		// Old 'page' path
		const bank = xyToOldBankIndex(location.column, location.row)
		if (bank === null) return

		// Update ember+ with internal state of button
		this.#updateNodePath(buildPathForButton(location.pageNumber, bank, LEGACY_NODE_TEXT), style.text?.text || '')
		this.#updateNodePath(
			buildPathForButton(location.pageNumber, bank, LEGACY_NODE_TEXT_COLOR),
			formatColorAsHex(style.text?.color || 0)
		)
		this.#updateNodePath(
			buildPathForButton(location.pageNumber, bank, LEGACY_NODE_BG_COLOR),
			formatColorAsHex(style.color?.color || 0)
		)
	}

	#updateNodePath(path: string, newValue: EmberValue): void {
		if (!this.#server) return

		const node = this.#server.getElementByPath(path)
		if (!node) return

		// @ts-expect-error node type may not have a value property
		if (node.contents.value !== newValue) {
			this.#server.update(node, { value: newValue })
		}
	}

	/**
	 * Process an updated userconfig value and enable/disable the module, if necessary.
	 */
	updateUserConfig(key: string, value: boolean | number | string): void {
		super.updateUserConfig(key, value)

		if (key == 'gridSize') {
			this.restartModule()
		}
	}
}
