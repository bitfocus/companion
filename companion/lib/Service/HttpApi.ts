import { CoreBase } from '../Core/Base.js'
import { ParseAlignment, parseColorToNumber, rgb } from '../Resources/Util.js'
import express from 'express'
import { formatLocation } from '@companion-app/shared/ControlId.js'
import Express from 'express'
import type { UIExpress } from '../UI/Express.js'
import type { Registry } from '../Registry.js'
import type { ButtonStyleProperties } from '@companion-app/shared/Model/StyleModel.js'
import type { ControlLocation } from '@companion-app/shared/Model/Common.js'

/**
 * Class providing the HTTP API.
 *
 * @author Håkon Nessjøen <haakon@bitfocus.io>
 * @author Keith Rocheck <keith.rocheck@gmail.com>
 * @author William Viker <william@bitfocus.io>
 * @author Julian Waller <me@julusian.co.uk>
 * @author Cole Bewley <cole.bewley@kjrh.com>
 * @since 1.2.0
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
export class ServiceHttpApi extends CoreBase {
	/**
	 * new Api express router
	 */
	readonly #apiRouter: express.Router

	/**
	 * new legacy Api express router
	 */
	readonly #legacyApiRouter: express.Router

	/**
	 * The web application framework
	 */
	readonly #express: UIExpress

	constructor(registry: Registry, express: UIExpress) {
		super(registry, 'Service/HttpApi')

		this.#express = express
		this.#apiRouter = Express.Router()
		this.#legacyApiRouter = Express.Router()

		this.#apiRouter.use((_req, res, next) => {
			// Check that the API is enabled
			if (this.userconfig.getKey('http_api_enabled')) {
				// Continue
				next()
			} else {
				// Disabled
				res.status(403).send()
			}
		})

		this.#setupNewHttpRoutes()
		this.#setupLegacyHttpRoutes()

		this.#express.apiRouter = this.#apiRouter
		this.#express.legacyApiRouter = this.#legacyApiRouter
	}

	#isLegacyRouteAllowed() {
		return !!(this.userconfig.getKey('http_api_enabled') && this.userconfig.getKey('http_legacy_api_enabled'))
	}

	#setupLegacyHttpRoutes() {
		this.#legacyApiRouter.options('/press/bank/*any', (_req, res, _next): void => {
			if (!this.#isLegacyRouteAllowed()) {
				res.status(403).send()
				return
			}

			res.header('Access-Control-Allow-Origin', '*')
			res.header('Access-Control-Allow-Methods', 'GET,OPTIONS')
			res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Content-Length, X-Requested-With')
			res.send(200)
		})

		this.#legacyApiRouter.get('/press/bank/:page/:bank', (req, res): void => {
			if (!this.#isLegacyRouteAllowed()) {
				res.status(403).send()
				return
			}

			res.header('Access-Control-Allow-Origin', '*')
			res.header('Access-Control-Allow-Methods', 'GET,OPTIONS')
			res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Content-Length, X-Requested-With')

			this.logger.info(`Got HTTP /press/bank/ (trigger) page ${req.params.page} button ${req.params.bank}`)

			const controlId = this.page.getControlIdAtOldBankIndex(Number(req.params.page), Number(req.params.bank))
			if (!controlId) {
				res.status(404)
				res.send('No control at location')
				return
			}

			this.controls.pressControl(controlId, true, 'http')

			setTimeout(() => {
				this.logger.info(`Auto releasing HTTP /press/bank/ page ${req.params.page} button ${req.params.bank}`)
				this.controls.pressControl(controlId, false, 'http')
			}, 20)

			res.send('ok')
		})

		this.#legacyApiRouter.get('/press/bank/:page/:bank/:direction', (req, res): void => {
			if (!this.#isLegacyRouteAllowed()) {
				res.status(403).send()
				return
			}

			res.header('Access-Control-Allow-Origin', '*')
			res.header('Access-Control-Allow-Methods', 'GET,OPTIONS')
			res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Content-Length, X-Requested-With')

			if (req.params.direction == 'down') {
				this.logger.info(`Got HTTP /press/bank/ (DOWN) page ${req.params.page} button ${req.params.bank}`)

				const controlId = this.page.getControlIdAtOldBankIndex(Number(req.params.page), Number(req.params.bank))
				if (!controlId) {
					res.status(404)
					res.send('No control at location')
					return
				}

				this.controls.pressControl(controlId, true, 'http')

				res.send('ok')
			} else if (req.params.direction == 'up') {
				this.logger.info(`Got HTTP /press/bank/ (UP) page ${req.params.page} button ${req.params.bank}`)

				const controlId = this.page.getControlIdAtOldBankIndex(Number(req.params.page), Number(req.params.bank))
				if (!controlId) {
					res.status(404)
					res.send('No control at location')
					return
				}

				this.controls.pressControl(controlId, false, 'http')

				res.send('ok')
			} else {
				res.status(404)
				res.send('Invalid direction')
			}
		})

		this.#legacyApiRouter.get('/rescan', async (_req, res): Promise<void> => {
			if (!this.#isLegacyRouteAllowed()) {
				res.status(403).send()
				return
			}

			res.header('Access-Control-Allow-Origin', '*')
			res.header('Access-Control-Allow-Methods', 'GET,OPTIONS')
			res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Content-Length, X-Requested-With')

			this.logger.info('Got HTTP /rescan')
			return this.surfaces.triggerRefreshDevices().then(
				() => {
					res.send('ok')
				},
				() => {
					res.send('fail')
				}
			)
		})

		this.#legacyApiRouter.get('/style/bank/:page/:bank', (req, res): void => {
			if (!this.#isLegacyRouteAllowed()) {
				res.status(403).send()
				return
			}

			res.header('Access-Control-Allow-Origin', '*')
			res.header('Access-Control-Allow-Methods', 'GET,OPTIONS')
			res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Content-Length, X-Requested-With')

			this.logger.info(`Got HTTP /style/bank ${req.params.page} button ${req.params.bank}`)

			const controlId = this.page.getControlIdAtOldBankIndex(Number(req.params.page), Number(req.params.bank))
			if (!controlId) {
				res.status(404)
				res.send('No control at location')
				return
			}

			const control = this.controls.getControl(controlId)

			if (!control || !control.supportsStyle) {
				res.status(404)
				res.send('Not found')
				return
			}

			const newFields: Partial<ButtonStyleProperties> = {}

			if (req.query.bgcolor) {
				const value = String(req.query.bgcolor).replace(/#/, '')
				const color = rgb(value.substr(0, 2), value.substr(2, 2), value.substr(4, 2), 16)
				if (color !== false) {
					newFields.bgcolor = color
				}
			}

			if (req.query.color) {
				const value = String(req.query.color).replace(/#/, '')
				const color = rgb(value.substr(0, 2), value.substr(2, 2), value.substr(4, 2), 16)
				if (color !== false) {
					newFields.color = color
				}
			}

			if (req.query.size) {
				const value = Number(String(req.query.size).replace(/pt/i, ''))
				newFields.size = value
			}

			if (req.query.text || req.query.text === '') {
				newFields.text = String(req.query.text)
			}

			if (req.query.png64 || req.query.png64 === '') {
				if (req.query.png64 === '') {
					newFields.png64 = null
				} else if (!String(req.query.png64).match(/data:.*?image\/png/)) {
					res.status(400)
					res.send('png64 must be a base64 encoded png file')
					return
				} else {
					newFields.png64 = String(req.query.png64)
				}
			}

			if (req.query.alignment) {
				try {
					const [, , alignment] = ParseAlignment(String(req.query.alignment))
					newFields.alignment = alignment
				} catch (e) {
					// Ignore
				}
			}

			if (req.query.pngalignment) {
				try {
					const [, , alignment] = ParseAlignment(String(req.query.pngalignment))
					newFields.pngalignment = alignment
				} catch (e) {
					// Ignore
				}
			}

			if (Object.keys(newFields).length > 0) {
				control.styleSetFields(newFields)
			}

			res.send('ok')
		})

		this.#legacyApiRouter.get('/set/custom-variable/:name', (req, res): void => {
			if (!this.#isLegacyRouteAllowed()) {
				res.status(403).send()
				return
			}

			res.header('Access-Control-Allow-Origin', '*')
			res.header('Access-Control-Allow-Methods', 'GET,OPTIONS')
			res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Content-Length, X-Requested-With')

			this.logger.debug(`Got HTTP /set/custom-variable/ name ${req.params.name} to value ${req.query.value}`)
			const result = this.variablesController.custom.setValue(req.params.name, String(req.query.value))
			if (result) {
				res.send(result)
			} else {
				res.send('ok')
			}
		})
	}

	#setupNewHttpRoutes() {
		// controls by location
		this.#apiRouter.post('/location/:page/:row/:column/press', this.#locationPress)
		this.#apiRouter.post('/location/:page/:row/:column/down', this.#locationDown)
		this.#apiRouter.post('/location/:page/:row/:column/up', this.#locationUp)
		this.#apiRouter.post('/location/:page/:row/:column/rotate-left', this.#locationRotateLeft)
		this.#apiRouter.post('/location/:page/:row/:column/rotate-right', this.#locationRotateRight)
		this.#apiRouter.post('/location/:page/:row/:column/step', this.#locationStep)
		this.#apiRouter.post('/location/:page/:row/:column/style', this.#locationStyle)

		// custom variables
		this.#apiRouter
			.route('/custom-variable/:name/value')
			.post(this.#customVariableSetValue)
			.get(this.#customVariableGetValue)

		// Module variables
		this.#apiRouter.route('/variable/:label/:name/value').get(this.#moduleVariableGetValue)

		// surfaces
		this.#apiRouter.post('/surfaces/rescan', this.#surfacesRescan)

		// Finally, default all unhandled to 404
		this.#apiRouter.use((_req, res) => {
			res.status(404).send('')
		})
	}

	/**
	 * Perform surfaces rescan
	 */
	#surfacesRescan = (_req: express.Request, res: express.Response): void => {
		this.logger.info('Got HTTP surface rescan')
		this.surfaces.triggerRefreshDevices().then(
			() => {
				res.send('ok')
			},
			() => {
				res.status(500).send('fail')
			}
		)
	}

	/**
	 * Perform surfaces rescan
	 */
	#locationParse = (req: express.Request): { location: ControlLocation; controlId: string | null } => {
		const location = {
			pageNumber: Number(req.params.page),
			row: Number(req.params.row),
			column: Number(req.params.column),
		}

		const controlId = this.page.getControlIdAt(location)

		return {
			location,
			controlId,
		}
	}

	/**
	 * Perform control press
	 */
	#locationPress = (req: express.Request, res: express.Response): void => {
		const { location, controlId } = this.#locationParse(req)
		this.logger.info(`Got HTTP control press ${formatLocation(location)} - ${controlId}`)

		if (!controlId) {
			res.status(204).send('No control')
			return
		}

		this.controls.pressControl(controlId, true, 'http')

		setTimeout(() => {
			this.logger.info(`Auto releasing HTTP control press ${formatLocation(location)} - ${controlId}`)

			this.controls.pressControl(controlId, false, 'http')
		}, 20)

		res.send('ok')
	}

	/**
	 * Perform control down
	 */
	#locationDown = (req: express.Request, res: express.Response): void => {
		const { location, controlId } = this.#locationParse(req)
		this.logger.info(`Got HTTP control down ${formatLocation(location)} - ${controlId}`)

		if (!controlId) {
			res.status(204).send('No control')
			return
		}

		this.controls.pressControl(controlId, true, 'http')

		res.send('ok')
	}

	/**
	 * Perform control up
	 */
	#locationUp = (req: express.Request, res: express.Response): void => {
		const { location, controlId } = this.#locationParse(req)
		this.logger.info(`Got HTTP control up ${formatLocation(location)} - ${controlId}`)

		if (!controlId) {
			res.status(204).send('No control')
			return
		}

		this.controls.pressControl(controlId, false, 'http')

		res.send('ok')
	}

	/**
	 * Perform control rotate left
	 */
	#locationRotateLeft = (req: express.Request, res: express.Response): void => {
		const { location, controlId } = this.#locationParse(req)
		this.logger.info(`Got HTTP control rotate left ${formatLocation(location)} - ${controlId}`)

		if (!controlId) {
			res.status(204).send('No control')
			return
		}

		this.controls.rotateControl(controlId, false, 'http')

		res.send('ok')
	}

	/**
	 * Perform control rotate right
	 */
	#locationRotateRight = (req: express.Request, res: express.Response): void => {
		const { location, controlId } = this.#locationParse(req)
		this.logger.info(`Got HTTP control rotate right ${formatLocation(location)} - ${controlId}`)

		if (!controlId) {
			res.status(204).send('No control')
			return
		}

		this.controls.rotateControl(controlId, true, 'http')

		res.send('ok')
	}

	/**
	 * Set control step
	 */
	#locationStep = (req: express.Request, res: express.Response): void => {
		const { location, controlId } = this.#locationParse(req)
		const step = Number(req.query.step)

		this.logger.info(`Got HTTP control step ${formatLocation(location)} - ${controlId} to ${step}`)
		if (!controlId) {
			res.status(204).send('No control')
			return
		}

		const control = this.controls.getControl(controlId)
		if (!control || !control.supportsSteps) {
			res.status(204).send('No control')
			return
		}

		if (!control.stepMakeCurrent(step)) {
			res.status(400).send('Bad step')
			return
		}

		res.send('ok')
	}

	/**
	 * Perform control style change
	 */
	#locationStyle = (req: express.Request, res: express.Response): void => {
		const { location, controlId } = this.#locationParse(req)
		this.logger.info(`Got HTTP control style ${formatLocation(location)} - ${controlId}`)

		if (!controlId) {
			res.status(204).send('No control')
			return
		}

		const control = this.controls.getControl(controlId)
		if (!control || !control.supportsStyle) {
			res.status(204).send('No control')
			return
		}

		const newFields: Partial<ButtonStyleProperties> = {}

		const bgcolor = req.query.bgcolor || req.body?.bgcolor
		if (bgcolor !== undefined) {
			const newColor = parseColorToNumber(bgcolor)
			if (newColor !== false) {
				newFields.bgcolor = newColor
			}
		}

		const fgcolor = req.query.color || req.body?.color
		if (fgcolor !== undefined) {
			const newColor = parseColorToNumber(fgcolor)
			if (newColor !== false) {
				newFields.color = newColor
			}
		}

		const size = req.query.size || req.body?.size
		if (size !== undefined) {
			const value = size === 'auto' ? 'auto' : parseInt(size)

			if (!isNaN(Number(value)) || typeof value === 'string') {
				newFields.size = value
			}
		}

		const text = req.query.text ?? req.body?.text
		if (text !== undefined) {
			newFields.text = text
		}

		const png64 = req.query.png64 ?? req.body?.png64
		if (png64 === '') {
			newFields.png64 = null
		} else if (png64 && png64.match(/data:.*?image\/png/)) {
			newFields.png64 = png64
		}

		const alignment = req.query.alignment || req.body?.alignment
		if (alignment) {
			const [, , tmpAlignment] = ParseAlignment(alignment, false)
			newFields.alignment = tmpAlignment
		}

		const pngalignment = req.query.pngalignment || req.body?.pngalignment
		if (pngalignment) {
			const [, , tmpAlignment] = ParseAlignment(pngalignment, false)
			newFields.pngalignment = tmpAlignment
		}

		if (Object.keys(newFields).length > 0) {
			control.styleSetFields(newFields)
		}

		// TODO - return style
		res.send('ok')
	}

	/**
	 * Perform custom variable set value
	 */
	#customVariableSetValue = (req: express.Request, res: express.Response): void => {
		const variableName = req.params.name
		let variableValue = null

		if (req.query.value !== undefined) {
			variableValue = req.query.value
		} else if (req.body && typeof req.body !== 'object') {
			variableValue = req.body?.toString().trim()
		}

		this.logger.debug(`Got HTTP custom variable set value name "${variableName}" to value "${variableValue}"`)
		if (variableValue === null) {
			res.status(400).send('No value')
			return
		}

		const result = this.variablesController.custom.setValue(variableName, variableValue)
		if (result) {
			res.status(404).send('Not found')
		} else {
			res.send('ok')
		}
	}

	/**
	 * Retrieve a custom variable current value
	 */
	#customVariableGetValue = (req: express.Request, res: express.Response): void => {
		const variableName = req.params.name

		this.logger.debug(`Got HTTP custom variable get value name "${variableName}"`)

		const result = this.variablesController.custom.getValue(variableName)
		if (result === undefined) {
			res.status(404).send('Not found')
		} else {
			if (typeof result === 'number') {
				res.send(result + '')
			} else {
				res.send(result)
			}
		}
	}
	/**
	 * Retrieve any module variable value
	 */
	#moduleVariableGetValue = (req: express.Request, res: express.Response): void => {
		const connectionLabel = req.params.label
		const variableName = req.params.name

		this.logger.debug(`Got HTTP module variable get value name "${connectionLabel}:${variableName}"`)

		const result = this.variablesController.values.getVariableValue(connectionLabel, variableName)
		if (result === undefined) {
			res.status(404).send('Not found')
		} else {
			if (typeof result === 'number') {
				res.send(result + '')
			} else {
				res.send(result)
			}
		}
	}
}
