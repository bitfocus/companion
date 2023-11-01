import CoreBase from '../Core/Base.js'
import { rgb } from '../Resources/Util.js'

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
	 * Express instance
	 * @type {import('express').Router}
	 * @access private
	 */
	apiRouter

	/**
	 * @param {import('../Registry.js').default} registry - the application core
	 * @param {import('express').Router} apiRouter - the http router
	 */
	constructor(registry, apiRouter) {
		super(registry, 'http-api', 'Service/HttpApi')

		this.apiRouter = apiRouter

		this.#setupHttpRoutes()
	}

	#setupHttpRoutes() {
		this.apiRouter.options('/press/bank/*', (req, res, next) => {
			res.header('Access-Control-Allow-Origin', '*')
			res.header('Access-Control-Allow-Methods', 'GET,OPTIONS')
			res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Content-Length, X-Requested-With')
			res.send(200)
		})

		this.apiRouter.get('^/press/bank/:page([0-9]{1,2})/:bank([0-9]{1,2})', (req, res) => {
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

		this.apiRouter.get('^/press/bank/:page([0-9]{1,2})/:bank([0-9]{1,2})/:direction(down|up)', (req, res) => {
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

		this.apiRouter.get('^/rescan', (req, res) => {
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

		this.apiRouter.get('^/style/bank/:page([0-9]{1,2})/:bank([0-9]{1,2})', (req, res) => {
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

		this.apiRouter.get('^/set/custom-variable/:name', (req, res) => {
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
}
