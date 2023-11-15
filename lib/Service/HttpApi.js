import CoreBase from '../Core/Base.js'
import { ParseAlignment, parseColorToNumber, rgb } from '../Resources/Util.js'
import express from 'express'
import cors from 'cors'
import { formatLocation } from '../Shared/ControlId.js'

/**
 * Class providing the HTTP API.
 *
 * @extends CoreBase
 * @author Håkon Nessjøen <haakon@bitfocus.io>
 * @author Keith Rocheck <keith.rocheck@gmail.com>
 * @author William Viker <william@bitfocus.io>
 * @author Julian Waller <me@julusian.co.uk>
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
	 * Root express router
	 * @type {import('express').Router}
	 * @access private
	 */
	#legacyRouter

	/**
	 * Api router
	 * @type {import('express').Router}
	 * @access private
	 */
	#apiRouter

	/**
	 * @param {import('../Registry.js').default} registry - the application core
	 * @param {import('express').Router} router - the http router
	 */
	constructor(registry, router) {
		super(registry, 'http-api', 'Service/HttpApi')

		this.#legacyRouter = router
		this.#apiRouter = express.Router()
		this.#apiRouter.use(cors())

		this.#setupLegacyHttpRoutes()
		this.#setupNewHttpRoutes()
	}

	/**
	 *
	 * @param {import('express').Application} app
	 */
	bindToApp(app) {
		app.use(
			'/api',
			(_req, res, next) => {
				// Check that the API is enabled
				if (this.userconfig.getKey('http_api_enabled')) {
					// Continue
					next()
				} else {
					// Disabled
					res.status(403).send()
				}
			},
			this.#apiRouter
		)
	}

	#isLegacyRouteAllowed() {
		return !!(this.userconfig.getKey('http_api_enabled') && this.userconfig.getKey('http_legacy_api_enabled'))
	}

	#setupLegacyHttpRoutes() {
		this.#legacyRouter.options('/press/bank/*', (_req, res, _next) => {
			if (!this.#isLegacyRouteAllowed()) return res.status(403).send()

			res.header('Access-Control-Allow-Origin', '*')
			res.header('Access-Control-Allow-Methods', 'GET,OPTIONS')
			res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Content-Length, X-Requested-With')
			return res.send(200)
		})

		this.#legacyRouter.get('^/press/bank/:page([0-9]{1,2})/:bank([0-9]{1,2})', (req, res) => {
			if (!this.#isLegacyRouteAllowed()) return res.status(403).send()

			res.header('Access-Control-Allow-Origin', '*')
			res.header('Access-Control-Allow-Methods', 'GET,OPTIONS')
			res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Content-Length, X-Requested-With')

			this.logger.info(`Got HTTP /press/bank/ (trigger) page ${req.params.page} button ${req.params.bank}`)

			const controlId = this.registry.page.getControlIdAtOldBankIndex(Number(req.params.page), Number(req.params.bank))
			if (!controlId) {
				res.status(404)
				res.send('No control at location')
				return
			}

			this.registry.controls.pressControl(controlId, true, 'http')

			setTimeout(() => {
				this.logger.info(`Auto releasing HTTP /press/bank/ page ${req.params.page} button ${req.params.bank}`)
				this.registry.controls.pressControl(controlId, false, 'http')
			}, 20)

			return res.send('ok')
		})

		this.#legacyRouter.get('^/press/bank/:page([0-9]{1,2})/:bank([0-9]{1,2})/:direction(down|up)', (req, res) => {
			if (!this.#isLegacyRouteAllowed()) return res.status(403).send()

			res.header('Access-Control-Allow-Origin', '*')
			res.header('Access-Control-Allow-Methods', 'GET,OPTIONS')
			res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Content-Length, X-Requested-With')

			if (req.params.direction == 'down') {
				this.logger.info(`Got HTTP /press/bank/ (DOWN) page ${req.params.page} button ${req.params.bank}`)

				const controlId = this.registry.page.getControlIdAtOldBankIndex(
					Number(req.params.page),
					Number(req.params.bank)
				)
				if (!controlId) {
					res.status(404)
					res.send('No control at location')
					return
				}

				this.registry.controls.pressControl(controlId, true, 'http')
			} else {
				this.logger.info(`Got HTTP /press/bank/ (UP) page ${req.params.page} button ${req.params.bank}`)

				const controlId = this.registry.page.getControlIdAtOldBankIndex(
					Number(req.params.page),
					Number(req.params.bank)
				)
				if (!controlId) {
					res.status(404)
					res.send('No control at location')
					return
				}

				this.registry.controls.pressControl(controlId, false, 'http')
			}

			return res.send('ok')
		})

		this.#legacyRouter.get('^/rescan', (_req, res) => {
			if (!this.#isLegacyRouteAllowed()) return res.status(403).send()

			res.header('Access-Control-Allow-Origin', '*')
			res.header('Access-Control-Allow-Methods', 'GET,OPTIONS')
			res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Content-Length, X-Requested-With')

			this.logger.info('Got HTTP /rescan')
			return this.registry.surfaces.triggerRefreshDevices().then(
				() => {
					res.send('ok')
				},
				() => {
					res.send('fail')
				}
			)
		})

		this.#legacyRouter.get('^/style/bank/:page([0-9]{1,2})/:bank([0-9]{1,2})', (req, res) => {
			if (!this.#isLegacyRouteAllowed()) return res.status(403).send()

			res.header('Access-Control-Allow-Origin', '*')
			res.header('Access-Control-Allow-Methods', 'GET,OPTIONS')
			res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Content-Length, X-Requested-With')

			this.logger.info(`Got HTTP /style/bank ${req.params.page} button ${req.params.bank}`)

			const controlId = this.registry.page.getControlIdAtOldBankIndex(Number(req.params.page), Number(req.params.bank))
			if (!controlId) {
				res.status(404)
				res.send('No control at location')
				return
			}

			const control = this.registry.controls.getControl(controlId)

			if (!control || !control.supportsStyle) {
				res.status(404)
				res.send('Not found')
				return
			}

			const newFields = {}

			if (req.query.bgcolor) {
				const value = req.query.bgcolor.replace(/#/, '')
				const color = rgb(value.substr(0, 2), value.substr(2, 2), value.substr(4, 2), 16)
				if (color !== false) {
					newFields.bgcolor = color
				}
			}

			if (req.query.color) {
				const value = req.query.color.replace(/#/, '')
				const color = rgb(value.substr(0, 2), value.substr(2, 2), value.substr(4, 2), 16)
				if (color !== false) {
					newFields.color = color
				}
			}

			if (req.query.size) {
				const value = req.query.size.replace(/pt/i, '')
				newFields.size = value
			}

			if (req.query.text || req.query.text === '') {
				newFields.text = req.query.text
			}

			if (req.query.png64 || req.query.png64 === '') {
				if (req.query.png64 === '') {
					newFields.png64 = null
				} else if (!req.query.png64.match(/data:.*?image\/png/)) {
					res.status(400)
					res.send('png64 must be a base64 encoded png file')
					return
				} else {
					newFields.png64 = req.query.png64
				}
			}

			if (req.query.alignment) {
				try {
					const [, , alignment] = ParseAlignment(req.query.alignment)
					newFields.alignment = alignment
				} catch (e) {
					// Ignore
				}
			}

			if (req.query.pngalignment) {
				try {
					const [, , alignment] = ParseAlignment(req.query.pngalignment)
					newFields.pngalignment = alignment
				} catch (e) {
					// Ignore
				}
			}

			if (Object.keys(newFields).length > 0) {
				control.styleSetFields(newFields)
			}

			return res.send('ok')
		})

		this.#legacyRouter.get('^/set/custom-variable/:name', (req, res) => {
			if (!this.#isLegacyRouteAllowed()) return res.status(403).send()

			res.header('Access-Control-Allow-Origin', '*')
			res.header('Access-Control-Allow-Methods', 'GET,OPTIONS')
			res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Content-Length, X-Requested-With')

			this.logger.debug(`Got HTTP /set/custom-variable/ name ${req.params.name} to value ${req.query.value}`)
			const result = this.registry.instance.variable.custom.setValue(req.params.name, req.query.value)
			if (result) {
				return res.send(result)
			} else {
				return res.send('ok')
			}
		})
	}

	#setupNewHttpRoutes() {
		// controls by location
		this.#apiRouter.post('/location/:page([0-9]{1,2})/:row(-?[0-9]+)/:column(-?[0-9]+)/press', this.#locationPress)
		this.#apiRouter.post('/location/:page([0-9]{1,2})/:row(-?[0-9]+)/:column(-?[0-9]+)/down', this.#locationDown)
		this.#apiRouter.post('/location/:page([0-9]{1,2})/:row(-?[0-9]+)/:column(-?[0-9]+)/up', this.#locationUp)
		this.#apiRouter.post(
			'/location/:page([0-9]{1,2})/:row(-?[0-9]+)/:column(-?[0-9]+)/rotate-left',
			this.#locationRotateLeft
		)
		this.#apiRouter.post(
			'/location/:page([0-9]{1,2})/:row(-?[0-9]+)/:column(-?[0-9]+)/rotate-right',
			this.#locationRotateRight
		)
		this.#apiRouter.post('/location/:page([0-9]{1,2})/:row(-?[0-9]+)/:column(-?[0-9]+)/step', this.#locationStep)
		this.#apiRouter.post('/location/:page([0-9]{1,2})/:row(-?[0-9]+)/:column(-?[0-9]+)/style', this.#locationStyle)

		// custom variables
		this.#apiRouter.post('/custom-variable/:name/value', this.#customVariableSetValue)
		this.#apiRouter.get('/custom-variable/:name/value', this.#customVariableGetValue)

		// surfaces
		this.#apiRouter.post('/surfaces/rescan', this.#surfacesRescan)

		// Finally, default all unhandled to 404
		this.#apiRouter.use('*', (_req, res) => {
			res.status(404).send('')
		})
	}

	/**
	 * Perform surfaces rescan
	 * @param {express.Request} _req
	 * @param {express.Response} res
	 * @returns {void}
	 */
	#surfacesRescan = (_req, res) => {
		this.logger.info('Got HTTP surface rescan')
		this.registry.surfaces.triggerRefreshDevices().then(
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
	 * @param {express.Request} req
	 * @returns {{ location: import('../Resources/Util.js').ControlLocation, controlId: string | null }}
	 */
	#locationParse = (req) => {
		const location = {
			pageNumber: Number(req.params.page),
			row: Number(req.params.row),
			column: Number(req.params.column),
		}

		const controlId = this.registry.page.getControlIdAt(location)

		return {
			location,
			controlId,
		}
	}

	/**
	 * Perform control press
	 * @param {express.Request} req
	 * @param {express.Response} res
	 * @returns {void}
	 */
	#locationPress = (req, res) => {
		const { location, controlId } = this.#locationParse(req)
		this.logger.info(`Got HTTP control press ${formatLocation(location)} - ${controlId}`)

		if (!controlId) {
			res.status(204).send('No control')
			return
		}

		this.registry.controls.pressControl(controlId, true, 'http')

		setTimeout(() => {
			this.logger.info(`Auto releasing HTTP control press ${formatLocation(location)} - ${controlId}`)

			this.registry.controls.pressControl(controlId, false, 'http')
		}, 20)

		res.send('ok')
	}

	/**
	 * Perform control down
	 * @param {express.Request} req
	 * @param {express.Response} res
	 * @returns {void}
	 */
	#locationDown = (req, res) => {
		const { location, controlId } = this.#locationParse(req)
		this.logger.info(`Got HTTP control down ${formatLocation(location)} - ${controlId}`)

		if (!controlId) {
			res.status(204).send('No control')
			return
		}

		this.registry.controls.pressControl(controlId, true, 'http')

		res.send('ok')
	}

	/**
	 * Perform control up
	 * @param {express.Request} req
	 * @param {express.Response} res
	 * @returns {void}
	 */
	#locationUp = (req, res) => {
		const { location, controlId } = this.#locationParse(req)
		this.logger.info(`Got HTTP control up ${formatLocation(location)} - ${controlId}`)

		if (!controlId) {
			res.status(204).send('No control')
			return
		}

		this.registry.controls.pressControl(controlId, false, 'http')

		res.send('ok')
	}

	/**
	 * Perform control rotate left
	 * @param {express.Request} req
	 * @param {express.Response} res
	 * @returns {void}
	 */
	#locationRotateLeft = (req, res) => {
		const { location, controlId } = this.#locationParse(req)
		this.logger.info(`Got HTTP control rotate left ${formatLocation(location)} - ${controlId}`)

		if (!controlId) {
			res.status(204).send('No control')
			return
		}

		this.registry.controls.rotateControl(controlId, false, 'http')

		res.send('ok')
	}

	/**
	 * Perform control rotate right
	 * @param {express.Request} req
	 * @param {express.Response} res
	 * @returns {void}
	 */
	#locationRotateRight = (req, res) => {
		const { location, controlId } = this.#locationParse(req)
		this.logger.info(`Got HTTP control rotate right ${formatLocation(location)} - ${controlId}`)

		if (!controlId) {
			res.status(204).send('No control')
			return
		}

		this.registry.controls.rotateControl(controlId, true, 'http')

		res.send('ok')
	}

	/**
	 * Set control step
	 * @param {express.Request} req
	 * @param {express.Response} res
	 * @returns {void}
	 */
	#locationStep = (req, res) => {
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
	 * @param {express.Request} req
	 * @param {express.Response} res
	 * @returns {void}
	 */
	#locationStyle = (req, res) => {
		const { location, controlId } = this.#locationParse(req)
		this.logger.info(`Got HTTP control syle ${formatLocation(location)} - ${controlId}`)

		if (!controlId) {
			res.status(204).send('No control')
			return
		}

		const control = this.registry.controls.getControl(controlId)
		if (!control || !control.supportsStyle) {
			res.status(204).send('No control')
			return
		}

		const newFields = {}

		const bgcolor = req.query.bgcolor || req.body.bgcolor
		if (bgcolor !== undefined) {
			const newColor = parseColorToNumber(bgcolor)
			if (newColor !== false) {
				newFields.bgcolor = newColor
			}
		}

		const fgcolor = req.query.color || req.body.color
		if (fgcolor !== undefined) {
			const newColor = parseColorToNumber(fgcolor)
			if (newColor !== false) {
				newFields.color = newColor
			}
		}

		const size = req.query.size || req.body.size
		if (size !== undefined) {
			const value = size === 'auto' ? 'auto' : parseInt(size)

			if (!isNaN(Number(value)) || typeof value === 'string') {
				newFields.size = value
			}
		}

		const text = req.query.text ?? req.body.text
		if (text !== undefined) {
			newFields.text = text
		}

		const png64 = req.query.png64 ?? req.body.png64
		if (png64 === '') {
			newFields.png64 = null
		} else if (png64 && png64.match(/data:.*?image\/png/)) {
			newFields.png64 = png64
		}

		const alignment = req.query.alignment || req.body.alignment
		if (alignment) {
			const [, , tmpAlignment] = ParseAlignment(alignment, false)
			newFields.alignment = tmpAlignment
		}

		const pngalignment = req.query.pngalignment || req.body.pngalignment
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
	 * @param {express.Request} req
	 * @param {express.Response} res
	 * @returns {void}
	 */
	#customVariableSetValue = (req, res) => {
		const variableName = req.params.name
		let variableValue = null

		if (req.query.value !== undefined) {
			variableValue = req.query.value
		} else if (req.body && typeof req.body !== 'object') {
			variableValue = req.body.toString().trim()
		}

		this.logger.debug(`Got HTTP custom variable set value name "${variableName}" to value "${variableValue}"`)
		if (variableValue === null) {
			res.status(400).send('No value')
			return
		}

		const result = this.registry.instance.variable.custom.setValue(variableName, variableValue)
		if (result) {
			res.status(404).send('Not found')
		} else {
			res.send('ok')
		}
	}

	/**
	 * Retrieve a custom variable current value
	 * @param {express.Request} req
	 * @param {express.Response} res
	 * @returns {void}
	 */
	#customVariableGetValue = (req, res) => {
		const variableName = req.params.name

		this.logger.debug(`Got HTTP custom variable get value name "${variableName}"`)

		const result = this.registry.instance.variable.custom.getValue(variableName)
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
