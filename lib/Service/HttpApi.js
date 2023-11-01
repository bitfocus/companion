import CoreBase from '../Core/Base.js'
import { ParseAlignment, rgb } from '../Resources/Util.js'
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
	#router

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

		this.#router = router
		this.#apiRouter = express.Router()
		this.#apiRouter.use(cors())
		this.#router.use('/api', this.#apiRouter)

		this.#setupLegacyHttpRoutes()
		this.#setupNewHttpRoutes()
	}

	#setupLegacyHttpRoutes() {
		// TODO - are these `options` handlers needed
		this.#router.options('/press/bank/*', (req, res, next) => {
			res.header('Access-Control-Allow-Origin', '*')
			res.header('Access-Control-Allow-Methods', 'GET,OPTIONS')
			res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Content-Length, X-Requested-With')
			res.send(200)
		})

		this.#router.get('^/press/bank/:page([0-9]{1,2})/:bank([0-9]{1,2})', (req, res) => {
			res.header('Access-Control-Allow-Origin', '*')
			res.header('Access-Control-Allow-Methods', 'GET,OPTIONS')
			res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Content-Length, X-Requested-With')

			this.logger.info(`Got HTTP /press/bank/ (trigger) page ${req.params.page} button ${req.params.bank}`)

			const controlId = this.registry.page.getControlIdAtOldBankIndex(req.params.page, req.params.bank)
			this.registry.controls.pressControl(controlId, true)

			setTimeout(() => {
				this.logger.info(`Auto releasing HTTP /press/bank/ page ${req.params.page} button ${req.params.bank}`)
				this.registry.controls.pressControl(controlId, false)
			}, 20)

			res.send('ok')
		})

		this.#router.get('^/press/bank/:page([0-9]{1,2})/:bank([0-9]{1,2})/:direction(down|up)', (req, res) => {
			res.header('Access-Control-Allow-Origin', '*')
			res.header('Access-Control-Allow-Methods', 'GET,OPTIONS')
			res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Content-Length, X-Requested-With')

			if (req.params.direction == 'down') {
				this.logger.info(`Got HTTP /press/bank/ (DOWN) page ${req.params.page} button ${req.params.bank}`)

				const controlId = this.registry.page.getControlIdAtOldBankIndex(req.params.page, req.params.bank)
				this.registry.controls.pressControl(controlId, true)
			} else {
				this.logger.info(`Got HTTP /press/bank/ (UP) page ${req.params.page} button ${req.params.bank}`)

				const controlId = this.registry.page.getControlIdAtOldBankIndex(req.params.page, req.params.bank)
				this.registry.controls.pressControl(controlId, false)
			}

			res.send('ok')
		})

		this.#router.get('^/rescan', (req, res) => {
			res.header('Access-Control-Allow-Origin', '*')
			res.header('Access-Control-Allow-Methods', 'GET,OPTIONS')
			res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Content-Length, X-Requested-With')

			this.logger.info('Got HTTP /rescan')
			this.registry.surfaces.triggerRefreshDevices().then(
				() => {
					res.send('ok')
				},
				() => {
					res.send('fail')
				}
			)
		})

		this.#router.get('^/style/bank/:page([0-9]{1,2})/:bank([0-9]{1,2})', (req, res) => {
			res.header('Access-Control-Allow-Origin', '*')
			res.header('Access-Control-Allow-Methods', 'GET,OPTIONS')
			res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Content-Length, X-Requested-With')

			this.logger.info(`Got HTTP /style/bank ${req.params.page} button ${req.params.bank}`)

			const controlId = this.registry.page.getControlIdAtOldBankIndex(req.params.page, req.params.bank)
			const control = this.registry.controls.getControl(controlId)

			if (!control || typeof control.styleSetFields !== 'function') {
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
					const data = req.query.png64.replace(/^.*base64,/, '')
					newFields.png64 = data
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

			res.send('ok')
		})

		this.#router.get('^/set/custom-variable/:name', (req, res) => {
			res.header('Access-Control-Allow-Origin', '*')
			res.header('Access-Control-Allow-Methods', 'GET,OPTIONS')
			res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Content-Length, X-Requested-With')

			this.logger.debug(`Got HTTP /set/custom-variable/ name ${req.params.name} to value ${req.query.value}`)
			const result = this.registry.instance.variable.custom.setValue(req.params.name, req.query.value)
			if (result) {
				res.send(result)
			} else {
				res.send('ok')
			}
		})
	}

	#setupNewHttpRoutes() {
		// controls
		this.#apiRouter.post('/controls/:page([0-9]{1,2})/:row(-?[0-9]+)/:column(-?[0-9]+)/press', this.#controlPress)
		this.#apiRouter.post('/controls/:page([0-9]{1,2})/:row(-?[0-9]+)/:column(-?[0-9]+)/down', this.#controlDown)
		this.#apiRouter.post('/controls/:page([0-9]{1,2})/:row(-?[0-9]+)/:column(-?[0-9]+)/up', this.#controlUp)
		this.#apiRouter.post(
			'/controls/:page([0-9]{1,2})/:row(-?[0-9]+)/:column(-?[0-9]+)/rotate-left',
			this.#controlRotateLeft
		)
		this.#apiRouter.post(
			'/controls/:page([0-9]{1,2})/:row(-?[0-9]+)/:column(-?[0-9]+)/rotate-right',
			this.#controlRotateRight
		)

		// custom variables
		this.#apiRouter.post('/custom-variable/:name/set-value', this.#customVariableSetValue)

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
				res.send('fail')
			}
		)
	}

	/**
	 * Perform control press
	 * @param {express.Request} req
	 * @param {express.Response} res
	 * @returns {void}
	 */
	#controlPress = (req, res) => {
		const location = {
			pageNumber: Number(req.params.page),
			row: Number(req.params.row),
			column: Number(req.params.column),
		}

		const controlId = this.registry.page.getControlIdAt(location)
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
	#controlDown = (req, res) => {
		const location = {
			pageNumber: Number(req.params.page),
			row: Number(req.params.row),
			column: Number(req.params.column),
		}

		const controlId = this.registry.page.getControlIdAt(location)
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
	#controlUp = (req, res) => {
		const location = {
			pageNumber: Number(req.params.page),
			row: Number(req.params.row),
			column: Number(req.params.column),
		}

		const controlId = this.registry.page.getControlIdAt(location)
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
	#controlRotateLeft = (req, res) => {
		const location = {
			pageNumber: Number(req.params.page),
			row: Number(req.params.row),
			column: Number(req.params.column),
		}

		const controlId = this.registry.page.getControlIdAt(location)
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
	#controlRotateRight = (req, res) => {
		const location = {
			pageNumber: Number(req.params.page),
			row: Number(req.params.row),
			column: Number(req.params.column),
		}

		const controlId = this.registry.page.getControlIdAt(location)
		this.logger.info(`Got HTTP control rotate right ${formatLocation(location)} - ${controlId}`)

		if (!controlId) {
			res.status(204).send('No control')
			return
		}

		this.registry.controls.rotateControl(controlId, true, 'http')

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
		} else if (req.body) {
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
}
