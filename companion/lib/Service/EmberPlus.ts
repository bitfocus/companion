import { EmberServer, Model as EmberModel } from 'emberplus-connection'
import { getPath } from 'emberplus-connection/dist/Ember/Lib/util.js'
import { ServiceBase } from './Base.js'
import { formatLocation, xyToOldBankIndex } from '@companion-app/shared/ControlId.js'
import { pad } from '@companion-app/shared/Util.js'
import { parseColorToNumber } from '../Resources/Util.js'
import { LEGACY_MAX_BUTTONS } from '../Resources/Constants.js'
import type { UserConfigGridSize } from '@companion-app/shared/Model/UserConfigModel.js'
import type { EmberValue } from 'emberplus-connection/dist/types/types.js'
import type { ImageResult } from '../Graphics/ImageResult.js'
import type { ControlLocation } from '@companion-app/shared/Model/Common.js'
import type { ServiceApi } from './ServiceApi.js'
import type { DataUserConfig } from '../Data/UserConfig.js'
import type { PageController } from '../Page/Controller.js'
import debounceFn from 'debounce-fn'

// const LOCATION_NODE_CONTROLID = 0
const LOCATION_NODE_PRESSED = 1
const LOCATION_NODE_TEXT = 2
const LOCATION_NODE_TEXT_COLOR = 3
const LOCATION_NODE_BG_COLOR = 4

const LEGACY_NODE_STATE = 0
const LEGACY_NODE_TEXT = 1
const LEGACY_NODE_TEXT_COLOR = 2
const LEGACY_NODE_BG_COLOR = 3

const DEBOUNCE_REINIT_DELAY = 2500

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
	#customVars: string[] = []
	#internalVars: string[] = []

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
		this.startListening()
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

	private startListening(): void {
		this.#serviceApi.on('variables_changed', (variables, connection_labels) => {
			if ((!connection_labels.has('internal') && !connection_labels.has('custom')) || this.#server == undefined) return // We don't care about any other variables
			variables.forEach((changedVariable) => {
				if (this.#server == undefined) return
				let label = changedVariable.split(':')[0]
				let name = changedVariable.split(':')[1]
				if (label == 'internal' && name.startsWith('custom')) {
					label = 'custom'
					name = name.substring(7)
				}
				if (label === 'custom') {
					const i = this.#customVars.indexOf(name)
					if (i == -1) {
						this.logger.debug(`New custom variable: ${name} restarting server`)
						this.debounceRestart()
					} else {
						const node = this.#server.getElementByPath(`0.3.2.${i}.1`)
						if (node) {
							const value = this.#serviceApi.getCustomVariableValue(this.#customVars[i])?.toString()
							if (value === undefined) return
							// @ts-ignore
							if (node.contents.value !== value) {
								this.#server.update(node, { value: value })
							}
						}
					}
				} else if (label === 'internal') {
					const i = this.#internalVars.indexOf(name)
					if (i == -1) {
						this.logger.debug(`New internal variable: ${name} restarting server`)
						this.debounceRestart()
					} else {
						const node = this.#server.getElementByPath(`0.3.1.${i}.1`)
						if (node) {
							const value = this.#serviceApi.getConnectionVariableValue('internal', this.#internalVars[i])
							if (value === undefined) return
							// @ts-ignore
							if (node.contents.value !== value) {
								this.#server.update(node, { value: value })
							}
						}
						if (name == 'action_recorder_action_count') {
							const node = this.#server.getElementByPath('0.4.2')
							if (node) {
								const count = this.#serviceApi.getConnectionVariableValue('internal', 'action_recorder_action_count')
								// @ts-ignore
								if (node.contents.value !== count) {
									this.#server.update(node, { value: count })
								}
							}
						}
					}
				}
			})
		})
		this.#serviceApi.on('definition_changed', (id, info) => {
			if (this.#server) {
				if (!this.#customVars.includes(id) || info == null) {
					this.debounceRestart()
					this.logger.debug(`Custom variable definiation changed for ${id} restarting server`)
				}
			}
		})
		this.#serviceApi.on('is_running', (is_running) => {
			if (this.#server) {
				//check action recorder status
				const node = this.#server.getElementByPath('0.4.0')
				if (node) {
					// @ts-ignore
					if (node.contents.value !== is_running) {
						this.#server.update(node, { value: is_running })
					}
				}
			}
		})
		this.#serviceApi.listenForActionRecorderEvents()
		this.#serviceApi.listenForChangedVariables()
	}

	/**
	 * Get the page/bank structure in EmberModel form
	 */
	#getPagesTree(): Record<number, EmberModel.NumberedTreeNodeImpl<any>> {
		let output: Record<number, EmberModel.NumberedTreeNodeImpl<any>> = {}

		const pageCount = this.#pageController.getPageCount() // TODO - handle resize

		for (let pageNumber = 1; pageNumber <= pageCount; pageNumber++) {
			const children: Record<number, EmberModel.NumberedTreeNodeImpl<any>> = {}
			for (let bank = 1; bank <= LEGACY_MAX_BUTTONS; bank++) {
				const controlId = this.#pageController.getControlIdAtOldBankIndex(pageNumber, bank)
				const control = controlId ? this.#serviceApi.getControl(controlId) : undefined

				let drawStyle = control?.getDrawStyle?.() || null
				if (drawStyle?.style !== 'button') drawStyle = null

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
								drawStyle?.text || '',
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
								formatColorAsHex(drawStyle?.color || 0),
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
								formatColorAsHex(drawStyle?.bgcolor || 0),
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

					const location = {
						pageNumber,
						row,
						column,
					}
					const controlId = this.#pageController.getControlIdAt(location)
					const control = controlId ? this.#serviceApi.getControl(controlId) : undefined

					let drawStyle = control?.getDrawStyle?.() || null
					if (drawStyle?.style !== 'button') drawStyle = null

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
									drawStyle?.text || '',
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
									formatColorAsHex(drawStyle?.color || 0),
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
									formatColorAsHex(drawStyle?.bgcolor || 0),
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
	 * Get variable structure in EmberModel form
	 */
	#getVariableTree(): Record<number, EmberModel.NumberedTreeNodeImpl<any>> {
		this.#customVars = this.#serviceApi.getCustomVariableDefinitions() ?? []
		this.#internalVars = this.#serviceApi.getConnectionVariableDefinitions('internal') ?? []
		const customVarNodes: Record<number, EmberModel.NumberedTreeNodeImpl<any>> = {}
		const internalVarNodes: Record<number, EmberModel.NumberedTreeNodeImpl<any>> = {}
		const output: Record<number, EmberModel.NumberedTreeNodeImpl<any>> = {}
		this.logger.debug(`Internal Variable Count: ${this.#internalVars.length}\n${this.#internalVars}`)
		this.logger.debug(`Custom Variable Count: ${this.#customVars.length}\n${this.#customVars}`)
		for (let i = 0; i < this.#internalVars.length; i++) {
			let value = this.#serviceApi.getConnectionVariableValue('internal', this.#internalVars[i])
			const type: EmberModel.ParameterType =
				typeof value == 'number'
					? EmberModel.ParameterType.Integer
					: typeof value == 'boolean'
						? EmberModel.ParameterType.Boolean
						: EmberModel.ParameterType.String
			const id: string = typeof value == 'number' ? 'integer' : typeof value == 'boolean' ? 'boolean' : 'string'
			internalVarNodes[i] = new EmberModel.NumberedTreeNodeImpl(
				i,
				new EmberModel.EmberNodeImpl(this.#internalVars[i]),
				{
					0: new EmberModel.NumberedTreeNodeImpl(
						1,
						new EmberModel.ParameterImpl(
							type,
							id,
							`Internal variable: ${this.#internalVars[i]}`,
							value,
							undefined,
							undefined,
							EmberModel.ParameterAccess.Read
						)
					),
				}
			)
		}
		for (let i = 0; i < this.#customVars.length; i++) {
			let value = this.#serviceApi.getCustomVariableValue(this.#customVars[i])
			customVarNodes[i] = new EmberModel.NumberedTreeNodeImpl(i, new EmberModel.EmberNodeImpl(this.#customVars[i]), {
				0: new EmberModel.NumberedTreeNodeImpl(
					1,
					new EmberModel.ParameterImpl(
						EmberModel.ParameterType.String,
						'string',
						`Custom variable: ${this.#customVars[i]}`,
						value?.toString() ?? '',
						undefined,
						undefined,
						EmberModel.ParameterAccess.ReadWrite
					)
				),
			})
		}

		output[0] = new EmberModel.NumberedTreeNodeImpl(
			1,
			new EmberModel.EmberNodeImpl('internal variables'),
			internalVarNodes
		)
		output[1] = new EmberModel.NumberedTreeNodeImpl(2, new EmberModel.EmberNodeImpl('custom variables'), customVarNodes)
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
					3: new EmberModel.NumberedTreeNodeImpl(3, new EmberModel.EmberNodeImpl('variables'), this.#getVariableTree()),
					4: new EmberModel.NumberedTreeNodeImpl(4, new EmberModel.EmberNodeImpl('action recorder'), {
						0: new EmberModel.NumberedTreeNodeImpl(
							0,
							new EmberModel.ParameterImpl(
								EmberModel.ParameterType.Boolean,
								'Enable',
								'Start / Stop Action Recorder',
								this.#serviceApi.actionRecorderGetSession().isRunning,
								undefined,
								undefined,
								EmberModel.ParameterAccess.ReadWrite
							)
						),
						1: new EmberModel.NumberedTreeNodeImpl(
							1,
							new EmberModel.ParameterImpl(
								EmberModel.ParameterType.Boolean,
								'Discard',
								'Discard Recorded Actions',
								false,
								undefined,
								undefined,
								EmberModel.ParameterAccess.Write
							)
						),
						2: new EmberModel.NumberedTreeNodeImpl(
							2,
							new EmberModel.ParameterImpl(
								EmberModel.ParameterType.Integer,
								'Action Count',
								'Number of Recorded Actions',
								this.#serviceApi.getConnectionVariableValue('internal', 'action_recorder_action_count'),
								undefined,
								0,
								EmberModel.ParameterAccess.Read
							)
						),
					}),
				}),
			}

			this.#server = new EmberServer(this.port)
			this.#server.on('error', this.handleSocketError.bind(this))
			this.#server.onSetValue = this.setValue.bind(this)
			this.#server.init(root)

			this.currentState = true
			this.logger.info('Listening on port ' + this.port)
			this.logger.silly('Listening on port ' + this.port)
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
		if (this.#server === undefined) return false
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
						control.setStyleFields({ text: value })

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
						control.setStyleFields({ text: value })

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
		} else if (pathInfo[0] === '0' && pathInfo[1] === '3' && pathInfo[2] === '2' && pathInfo[4] === '1') {
			const customVar = this.#customVars[parseInt(pathInfo[3])]
			if (value !== undefined && value !== null) {
				this.#serviceApi.setCustomVariableValue(customVar, value.toString())
			}
		} else if (pathInfo[0] === '0' && pathInfo[1] === '4') {
			switch (pathInfo[2]) {
				case '0':
					this.#serviceApi.actionRecorderSetRecording(Boolean(value))
					this.#server.update(parameter, { value: this.#serviceApi.actionRecorderGetSession().isRunning })
					break
				case '1':
					if (value) {
						this.#serviceApi.actionRecorderDiscardActions()
						this.#server.update(parameter, { value: false })
					}
					break
			}
		}

		return false
	}

	/**
	 * Update the tree from the pageCount changing
	 */
	#pageCountChange(_pageCount: number): void {
		// TODO: This is excessive, but further research is needed to figure out how to edit the ember tree structure
		this.logger.debug(`Page count change restarting server`)
		this.debounceRestart()
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

		const style = typeof render.style !== 'string' ? render.style : undefined

		// New 'location' path
		const gridSize = this.userconfig.getKey('gridSize')
		if (gridSize) {
			this.#updateNodePath(buildPathForLocation(gridSize, location, LOCATION_NODE_TEXT), style?.text || '')
			this.#updateNodePath(
				buildPathForLocation(gridSize, location, LOCATION_NODE_TEXT_COLOR),
				formatColorAsHex(style?.color || 0)
			)
			this.#updateNodePath(
				buildPathForLocation(gridSize, location, LOCATION_NODE_BG_COLOR),
				formatColorAsHex(style?.bgcolor || 0)
			)
		}

		// Old 'page' path
		const bank = xyToOldBankIndex(location.column, location.row)
		if (bank === null) return

		// Update ember+ with internal state of button
		this.#updateNodePath(buildPathForButton(location.pageNumber, bank, LEGACY_NODE_TEXT), style?.text || '')
		this.#updateNodePath(
			buildPathForButton(location.pageNumber, bank, LEGACY_NODE_TEXT_COLOR),
			formatColorAsHex(style?.color || 0)
		)
		this.#updateNodePath(
			buildPathForButton(location.pageNumber, bank, LEGACY_NODE_BG_COLOR),
			formatColorAsHex(style?.bgcolor || 0)
		)
	}

	#updateNodePath(path: string, newValue: EmberValue): void {
		if (!this.#server) return

		const node = this.#server.getElementByPath(path)
		if (!node) return

		// @ts-ignore
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
			this.logger.debug(`Grid Size change restarting server`)
			this.debounceRestart()
		}
	}

	debounceRestart = debounceFn(
		() => {
			this.restartModule()
		},
		{ wait: DEBOUNCE_REINIT_DELAY, maxWait: 4 * DEBOUNCE_REINIT_DELAY }
	)
}
