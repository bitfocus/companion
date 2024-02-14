import { EmberServer, Model as EmberModel } from 'emberplus-connection'
import { getPath } from 'emberplus-connection/dist/Ember/Lib/util.js'
import ServiceBase from './Base.js'
import { formatLocation, xyToOldBankIndex } from '../Shared/ControlId.js'
import { pad, parseColorToNumber } from '../Resources/Util.js'

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
 * @param {import('../Shared/Model/UserConfigModel.js').UserConfigGridSize} gridSize
 * @param {import('../Resources/Util.js').ControlLocation} location
 * @param {number} node
 * @returns {string}
 */
function buildPathForLocation(gridSize, location, node) {
	const row = location.row - gridSize.minRow
	const column = location.column - gridSize.minColumn
	return `0.2.${location.pageNumber}.${row}.${column}.${node}`
}

/**
 * Generate ember+ path
 * @param {number} page
 * @param {number} bank
 * @param {number} node
 * @returns {string}
 */
function buildPathForButton(page, bank, node) {
	return `0.1.${page}.${bank}.${node}`
}
/**
 * Convert internal color to hex
 * @param {any} color
 * @returns {string}
 */
function formatColorAsHex(color) {
	const newColor = parseColorToNumber(color)
	if (newColor === false) return '#000000'
	return `#${pad(newColor.toString(16).slice(-6), '0', 6)}`
}
/**
 * Parse hex color as number
 * @param {string} hex
 * @returns {number}
 */
function parseHexColor(hex) {
	return parseInt(hex.slice(1, 7), 16)
}

/**
 * Class providing the Ember+ api.
 *
 * @extends ServiceBase
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
 *
 * You can be released from the requirements of the license by purchasing
 * a commercial license. Buying such a license is mandatory as soon as you
 * develop commercial activities involving the Companion software without
 * disclosing the source code of your own applications.
 */
class ServiceEmberPlus extends ServiceBase {
	/**
	 * @type {EmberServer | undefined}
	 * @access protected
	 */
	server = undefined

	/**
	 * The port to open the socket with.  Default: <code>9092</code>
	 * @type {number}
	 * @access protected
	 */
	port = 9092

	/**
	 * Bank state array
	 * @type {Set<string>}
	 * @access private
	 */
	#pushedButtons = new Set()

	/**
	 * @param {import('../Registry.js').default} registry - the application's core
	 */
	constructor(registry) {
		super(registry, 'ember+', 'Service/EmberPlus', 'emberplus_enabled', null)

		this.graphics.on('button_drawn', this.#updateBankFromRender.bind(this))

		this.init()
	}

	/**
	 * Close the socket before deleting it
	 * @access protected
	 */
	close() {
		if (this.server) {
			this.server.discard()
		}
	}

	/**
	 * Get the page/bank structure in EmberModel form
	 * @returns {Record<number, EmberModel.NumberedTreeNodeImpl<any>>}
	 * @access private
	 */
	#getPagesTree() {
		/** @type {Record<number, EmberModel.NumberedTreeNodeImpl<any>>} */
		let output = {}

		for (let pageNumber = 1; pageNumber <= 99; pageNumber++) {
			/** @type {Record<number, EmberModel.NumberedTreeNodeImpl<any>>} */
			const children = {}
			for (let bank = 1; bank <= 32; bank++) {
				const controlId = this.page.getControlIdAtOldBankIndex(pageNumber, bank)
				const control = controlId ? this.controls.getControl(controlId) : undefined

				/** @type {import('../Shared/Model/StyleModel.js').DrawStyleModel | null} */
				let drawStyle = control?.getDrawStyle() || null
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

			const pageName = this.page.getPageName(pageNumber)
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
	 * @returns {Record<number, EmberModel.NumberedTreeNodeImpl<any>>}
	 * @access private
	 */
	#getLocationTree() {
		/** @type {import('../Shared/Model/UserConfigModel.js').UserConfigGridSize} */
		const gridSize = this.userconfig.getKey('gridSize')
		if (!gridSize) return {}

		const rowCount = gridSize.maxRow - gridSize.minRow + 1
		const columnCount = gridSize.maxColumn - gridSize.minColumn + 1

		/** @type {Record<number, EmberModel.NumberedTreeNodeImpl<any>>} */
		const output = {}

		for (let pageNumber = 1; pageNumber <= 99; pageNumber++) {
			// TODO - the numbers won't be stable  when resizing the `min` grid values

			/** @type {Record<number, EmberModel.NumberedTreeNodeImpl<any>>} */
			const pageRows = {}
			for (let rowI = 0; rowI < rowCount; rowI++) {
				const row = gridSize.minRow + rowI
				/** @type {Record<number, EmberModel.NumberedTreeNodeImpl<any>>} */
				const rowColumns = {}

				for (let colI = 0; colI < columnCount; colI++) {
					const column = gridSize.minColumn + colI

					const location = {
						pageNumber,
						row,
						column,
					}
					const controlId = this.page.getControlIdAt(location)
					const control = controlId ? this.controls.getControl(controlId) : undefined

					/** @type {import('../Shared/Model/StyleModel.js').DrawStyleModel | null} */
					let drawStyle = control?.getDrawStyle() || null
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

			const pageName = this.page.getPageName(pageNumber)
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
	 * @access protected
	 */
	listen() {
		if (this.portConfig) {
			this.port = this.userconfig.getKey(this.portConfig)
		}

		if (this.server === undefined) {
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
									this.registry.appInfo.appVersion
								)
							),
							3: new EmberModel.NumberedTreeNodeImpl(
								3,
								new EmberModel.ParameterImpl(
									EmberModel.ParameterType.String,
									'build',
									undefined,
									this.registry.appInfo.appBuild
								)
							),
						}),
						1: new EmberModel.NumberedTreeNodeImpl(1, new EmberModel.EmberNodeImpl('pages'), this.#getPagesTree()),
						2: new EmberModel.NumberedTreeNodeImpl(
							2,
							new EmberModel.EmberNodeImpl('location'),
							this.#getLocationTree()
						),
					}),
				}

				this.server = new EmberServer(this.port)
				this.server.on('error', this.handleSocketError.bind(this))
				this.server.onSetValue = this.setValue.bind(this)
				this.server.init(root)

				this.currentState = true
				this.logger.info('Listening on port ' + this.port)
				this.logger.silly('Listening on port ' + this.port)
			} catch (/** @type {any} */ e) {
				this.logger.error(`Could not launch: ${e.message}`)
			}
		}
	}

	/**
	 * Process a received command
	 * @param {EmberModel.NumberedTreeNodeImpl<any>} parameter - the raw path
	 * @param {import('emberplus-connection/dist/types/types.js').EmberValue} value - the new value
	 * @returns {Promise<boolean>} - <code>true</code> if the command was successfully parsed
	 */
	async setValue(parameter, value) {
		const path = getPath(parameter)

		const pathInfo = path.split('.')
		// Check in the pages tree
		if (pathInfo[0] === '0' && pathInfo[1] === '1' && pathInfo.length === 5) {
			const page = parseInt(pathInfo[2])
			const bank = parseInt(pathInfo[3])
			const node = parseInt(pathInfo[4])

			if (isNaN(page) || isNaN(bank) || isNaN(node)) return false

			const controlId = this.page.getControlIdAtOldBankIndex(page, bank)
			if (!controlId) return false

			switch (node) {
				case LEGACY_NODE_STATE: {
					this.logger.silly(`Change button ${controlId} pressed to ${value}`)

					this.controls.pressControl(controlId, !!value, `emberplus`)
					this.server?.update(parameter, { value })
					return true
				}
				case LEGACY_NODE_TEXT: {
					this.logger.silly(`Change button ${controlId} text to ${value}`)

					const control = this.controls.getControl(controlId)
					if (control && control.supportsStyle) {
						control.styleSetFields({ text: value })

						// Note: this will be replaced shortly after with the value with feedbacks applied
						this.server?.update(parameter, { value })
						return true
					}
					return false
				}
				case LEGACY_NODE_TEXT_COLOR: {
					const color = parseHexColor(value + '')
					this.logger.silly(`Change button ${controlId} text color to ${value} (${color})`)

					const control = this.controls.getControl(controlId)
					if (control && control.supportsStyle) {
						control.styleSetFields({ color: color })

						// Note: this will be replaced shortly after with the value with feedbacks applied
						this.server?.update(parameter, { value })
						return true
					}
					return false
				}
				case LEGACY_NODE_BG_COLOR: {
					const color = parseHexColor(value + '')
					this.logger.silly(`Change bank ${controlId} background color to ${value} (${color})`)

					const control = this.controls.getControl(controlId)
					if (control && control.supportsStyle) {
						control.styleSetFields({ bgcolor: color })

						// Note: this will be replaced shortly after with the value with feedbacks applied
						this.server?.update(parameter, { value })
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

			const controlId = this.page.getControlIdAt({
				pageNumber,
				row,
				column,
			})
			if (!controlId) return false

			switch (node) {
				case LOCATION_NODE_PRESSED: {
					this.logger.silly(`Change bank ${controlId} pressed to ${value}`)

					this.controls.pressControl(controlId, !!value, `emberplus`)
					this.server?.update(parameter, { value })
					return true
				}
				case LOCATION_NODE_TEXT: {
					this.logger.silly(`Change bank ${controlId} text to ${value}`)

					const control = this.controls.getControl(controlId)
					if (control && control.supportsStyle) {
						control.styleSetFields({ text: value })

						// Note: this will be replaced shortly after with the value with feedbacks applied
						this.server?.update(parameter, { value })
						return true
					}
					return false
				}
				case LOCATION_NODE_TEXT_COLOR: {
					const color = parseHexColor(value + '')
					this.logger.silly(`Change bank ${controlId} text color to ${value} (${color})`)

					const control = this.controls.getControl(controlId)
					if (control && control.supportsStyle) {
						control.styleSetFields({ color: color })

						// Note: this will be replaced shortly after with the value with feedbacks applied
						this.server?.update(parameter, { value })
						return true
					}
					return false
				}
				case LOCATION_NODE_BG_COLOR: {
					const color = parseHexColor(value + '')
					this.logger.silly(`Change button ${controlId} background color to ${value} (${color})`)

					const control = this.controls.getControl(controlId)
					if (control && control.supportsStyle) {
						control.styleSetFields({ bgcolor: color })

						// Note: this will be replaced shortly after with the value with feedbacks applied
						this.server?.update(parameter, { value })
						return true
					}
					return false
				}
			}
		}

		return false
	}

	/**
	 * Send the latest bank state to the page/bank indicated
	 * @param {import('../Resources/Util.js').ControlLocation} location - the location of the control
	 * @param {boolean} pushed - the state
	 * @param {string | undefined} surfaceId - checks the <code>surfaceId</code> to ensure that Ember+ doesn't loop its own state change back
	 */
	updateButtonState(location, pushed, surfaceId) {
		if (!this.server) return
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
	 * @param {*} location
	 * @param {*} render
	 */
	#updateBankFromRender(location, render) {
		if (!this.server) return
		//this.logger.info(`Updating ${page}.${bank} label ${this.banks[page][bank].text}`)

		// New 'location' path
		const gridSize = this.userconfig.getKey('gridSize')
		if (gridSize) {
			this.#updateNodePath(buildPathForLocation(gridSize, location, LOCATION_NODE_TEXT), render.style?.text || '')
			this.#updateNodePath(
				buildPathForLocation(gridSize, location, LOCATION_NODE_TEXT_COLOR),
				formatColorAsHex(render.style?.color || 0)
			)
			this.#updateNodePath(
				buildPathForLocation(gridSize, location, LOCATION_NODE_BG_COLOR),
				formatColorAsHex(render.style?.bgcolor || 0)
			)
		}

		// Old 'page' path
		const bank = xyToOldBankIndex(location.column, location.row)
		if (bank === null) return

		// Update ember+ with internal state of button
		this.#updateNodePath(buildPathForButton(location.pageNumber, bank, LEGACY_NODE_TEXT), render.style?.text || '')
		this.#updateNodePath(
			buildPathForButton(location.pageNumber, bank, LEGACY_NODE_TEXT_COLOR),
			formatColorAsHex(render.style?.color || 0)
		)
		this.#updateNodePath(
			buildPathForButton(location.pageNumber, bank, LEGACY_NODE_BG_COLOR),
			formatColorAsHex(render.style?.bgcolor || 0)
		)
	}

	/**
	 *
	 * @param {string} path
	 * @param {import('emberplus-connection/dist/types/types.js').EmberValue} newValue
	 * @returns {void}
	 */
	#updateNodePath(path, newValue) {
		if (!this.server) return

		const node = this.server.getElementByPath(path)
		if (!node) return

		// @ts-ignore
		if (node.contents.value !== newValue) {
			this.server.update(node, { value: newValue })
		}
	}

	/**
	 * Process an updated userconfig value and enable/disable the module, if necessary.
	 * @param {string} key - the saved key
	 * @param {(boolean|number|string)} value - the saved value
	 * @access public
	 */
	updateUserConfig(key, value) {
		super.updateUserConfig(key, value)

		if (key == 'gridSize') {
			this.restartModule()
		}
	}
}

export default ServiceEmberPlus
