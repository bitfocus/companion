import Express from 'express'
import z from 'zod'
import { formatLocation, type BankControlId } from '@companion-app/shared/ControlId.js'
import { ParseAlignment } from '@companion-app/shared/Graphics/Util.js'
import type { ControlLocation } from '@companion-app/shared/Model/Common.js'
import type { ButtonStyleProperties } from '@companion-app/shared/Model/StyleModel.js'
import type { DataUserConfig } from '../Data/UserConfig.js'
import LogController from '../Log/Controller.js'
import { parseColorToNumber, rgb } from '../Resources/Util.js'
import type { UIExpress } from '../UI/Express.js'
import type { ServiceApi } from './ServiceApi.js'

const HTTP_API_SURFACE_ID = 'http'

/** A whole number from the path or query string: a page, row, column, bank or step */
const zodIntString = z
	.string()
	.regex(/^-?\d+$/)
	.transform(Number)

const LocationParamsSchema = z.object({ page: zodIntString, row: zodIntString, column: zodIntString })
const LegacyBankParamsSchema = z.object({ page: zodIntString, bank: zodIntString })
const StepQuerySchema = z.object({ step: zodIntString })

/** The style fields, each a single value: a query parameter given more than once arrives as an array */
const StyleQuerySchema = z.object({
	bgcolor: z.string().optional(),
	color: z.string().optional(),
	size: z.string().optional(),
	text: z.string().optional(),
	png64: z.string().optional(),
	alignment: z.string().optional(),
	pngalignment: z.string().optional(),
})
/** As the query, but a JSON body can also give a number */
const StyleBodySchema = z.object({
	bgcolor: z.union([z.string(), z.number()]).optional(),
	color: z.union([z.string(), z.number()]).optional(),
	size: z.union([z.string(), z.number()]).optional(),
	text: z.union([z.string(), z.number()]).transform(String).optional(),
	png64: z.string().optional(),
	alignment: z.string().optional(),
	pngalignment: z.string().optional(),
})

const ValueQuerySchema = z.object({ value: z.string().optional() })

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
 */
export class ServiceHttpApi {
	logger = LogController.createLogger('Service/HttpApi')

	readonly #serviceApi: ServiceApi

	readonly #userconfigController: DataUserConfig

	/**
	 * new Api express router
	 */
	readonly #apiRouter: Express.Router

	/**
	 * new legacy Api express router
	 */
	readonly #legacyApiRouter: Express.Router

	/**
	 * The web application framework
	 */
	readonly #express: UIExpress

	constructor(serviceApi: ServiceApi, userconfigController: DataUserConfig, express: UIExpress) {
		this.#serviceApi = serviceApi

		this.#userconfigController = userconfigController

		this.#express = express
		this.#apiRouter = Express.Router()
		this.#legacyApiRouter = Express.Router()

		this.#apiRouter.use((_req, res, next) => {
			// Check that the API is enabled
			if (this.#userconfigController.getKey('http_api_enabled')) {
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
		return !!(
			this.#userconfigController.getKey('http_api_enabled') &&
			this.#userconfigController.getKey('http_legacy_api_enabled')
		)
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

			const bank = LegacyBankParamsSchema.safeParse(req.params)
			if (!bank.success) {
				res.status(400).send('Bad location')
				return
			}
			const controlId = this.#serviceApi.getControlIdAtOldBankIndex(bank.data.page, bank.data.bank)
			if (!controlId) {
				res.status(404)
				res.send('No control at location')
				return
			}

			this.#serviceApi.pressControl(controlId, true, HTTP_API_SURFACE_ID)

			setTimeout(() => {
				this.logger.info(`Auto releasing HTTP /press/bank/ page ${req.params.page} button ${req.params.bank}`)
				this.#serviceApi.pressControl(controlId, false, HTTP_API_SURFACE_ID)
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

				const bank = LegacyBankParamsSchema.safeParse(req.params)
				if (!bank.success) {
					res.status(400).send('Bad location')
					return
				}
				const controlId = this.#serviceApi.getControlIdAtOldBankIndex(bank.data.page, bank.data.bank)
				if (!controlId) {
					res.status(404)
					res.send('No control at location')
					return
				}

				this.#serviceApi.pressControl(controlId, true, HTTP_API_SURFACE_ID)

				res.send('ok')
			} else if (req.params.direction == 'up') {
				this.logger.info(`Got HTTP /press/bank/ (UP) page ${req.params.page} button ${req.params.bank}`)

				const bank = LegacyBankParamsSchema.safeParse(req.params)
				if (!bank.success) {
					res.status(400).send('Bad location')
					return
				}
				const controlId = this.#serviceApi.getControlIdAtOldBankIndex(bank.data.page, bank.data.bank)
				if (!controlId) {
					res.status(404)
					res.send('No control at location')
					return
				}

				this.#serviceApi.pressControl(controlId, false, HTTP_API_SURFACE_ID)

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
			return this.#serviceApi.triggerRescanForSurfaces().then(
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

			const bank = LegacyBankParamsSchema.safeParse(req.params)
			if (!bank.success) {
				res.status(400).send('Bad location')
				return
			}
			const controlId = this.#serviceApi.getControlIdAtOldBankIndex(bank.data.page, bank.data.bank)
			if (!controlId) {
				res.status(404)
				res.send('No control at location')
				return
			}

			const control = this.#serviceApi.getControl(controlId)

			if (!control || !control.setStyleFields) {
				res.status(404)
				res.send('Not found')
				return
			}

			const query = StyleQuerySchema.safeParse(req.query)
			if (!query.success) {
				res.status(400).send('Bad style')
				return
			}
			const style = query.data

			const newFields: Partial<ButtonStyleProperties> = {}

			if (style.bgcolor) {
				const value = style.bgcolor.replace(/#/, '')
				const color = rgb(value.substr(0, 2), value.substr(2, 2), value.substr(4, 2), 16)
				if (color !== false) {
					newFields.bgcolor = color
				}
			}

			if (style.color) {
				const value = style.color.replace(/#/, '')
				const color = rgb(value.substr(0, 2), value.substr(2, 2), value.substr(4, 2), 16)
				if (color !== false) {
					newFields.color = color
				}
			}

			if (style.size) {
				const value = Number(style.size.replace(/pt/i, ''))
				newFields.size = value
			}

			if (style.text !== undefined) {
				newFields.text = style.text
			}

			if (style.png64 !== undefined) {
				if (style.png64 === '') {
					newFields.png64 = null
				} else if (!style.png64.match(/data:.*?image\/png/)) {
					res.status(400)
					res.send('png64 must be a base64 encoded png file')
					return
				} else {
					newFields.png64 = style.png64
				}
			}

			if (style.alignment) {
				try {
					const [, , alignment] = ParseAlignment(style.alignment)
					newFields.alignment = alignment
				} catch (_e) {
					// Ignore
				}
			}

			if (style.pngalignment) {
				try {
					const [, , alignment] = ParseAlignment(style.pngalignment)
					newFields.pngalignment = alignment
				} catch (_e) {
					// Ignore
				}
			}

			if (Object.keys(newFields).length > 0) {
				control.setStyleFields(newFields)
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

			const query = ValueQuerySchema.safeParse(req.query)
			if (!query.success || query.data.value === undefined) {
				res.status(400).send('No value')
				return
			}

			this.logger.debug(`Got HTTP /set/custom-variable/ name ${req.params.name} to value ${query.data.value}`)
			const result = this.#serviceApi.setCustomVariableValue(req.params.name, query.data.value)
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

		// connections
		this.#apiRouter.get('/connections', this.#connectionsList)
		this.#apiRouter.get('/connections/:id/status', this.#connectionGetStatus)
		this.#apiRouter.post('/connections/:id/restart', this.#connectionRestart)
		this.#apiRouter.post('/connections/:id/enable', this.#connectionEnable)
		this.#apiRouter.post('/connections/:id/disable', this.#connectionDisable)

		// Finally, default all unhandled to 404
		this.#apiRouter.use((_req, res) => {
			res.status(404).send('')
		})
	}

	/**
	 * Perform surfaces rescan
	 */
	#surfacesRescan = (_req: Express.Request, res: Express.Response): void => {
		this.logger.info('Got HTTP surface rescan')
		this.#serviceApi.triggerRescanForSurfaces().then(
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
	#locationParse = (
		req: Express.Request,
		res: Express.Response
	): { location: ControlLocation; controlId: BankControlId | null } | null => {
		const params = LocationParamsSchema.safeParse(req.params)
		if (!params.success) {
			res.status(400).send('Bad location')
			return null
		}
		const location = { pageNumber: params.data.page, row: params.data.row, column: params.data.column }

		const controlId = this.#serviceApi.getControlIdAt(location)

		return {
			location,
			controlId,
		}
	}

	/**
	 * Perform control press
	 */
	#locationPress = (req: Express.Request, res: Express.Response): void => {
		const parsed = this.#locationParse(req, res)
		if (!parsed) return
		const { location, controlId } = parsed
		this.logger.info(`Got HTTP control press ${formatLocation(location)} - ${controlId}`)

		if (!controlId) {
			res.status(204).send('No control')
			return
		}

		this.#serviceApi.pressControl(controlId, true, HTTP_API_SURFACE_ID)

		setTimeout(() => {
			this.logger.info(`Auto releasing HTTP control press ${formatLocation(location)} - ${controlId}`)

			this.#serviceApi.pressControl(controlId, false, HTTP_API_SURFACE_ID)
		}, 20)

		res.send('ok')
	}

	/**
	 * Perform control down
	 */
	#locationDown = (req: Express.Request, res: Express.Response): void => {
		const parsed = this.#locationParse(req, res)
		if (!parsed) return
		const { location, controlId } = parsed
		this.logger.info(`Got HTTP control down ${formatLocation(location)} - ${controlId}`)

		if (!controlId) {
			res.status(204).send('No control')
			return
		}

		this.#serviceApi.pressControl(controlId, true, HTTP_API_SURFACE_ID)

		res.send('ok')
	}

	/**
	 * Perform control up
	 */
	#locationUp = (req: Express.Request, res: Express.Response): void => {
		const parsed = this.#locationParse(req, res)
		if (!parsed) return
		const { location, controlId } = parsed
		this.logger.info(`Got HTTP control up ${formatLocation(location)} - ${controlId}`)

		if (!controlId) {
			res.status(204).send('No control')
			return
		}

		this.#serviceApi.pressControl(controlId, false, HTTP_API_SURFACE_ID)

		res.send('ok')
	}

	/**
	 * Perform control rotate left
	 */
	#locationRotateLeft = (req: Express.Request, res: Express.Response): void => {
		const parsed = this.#locationParse(req, res)
		if (!parsed) return
		const { location, controlId } = parsed
		this.logger.info(`Got HTTP control rotate left ${formatLocation(location)} - ${controlId}`)

		if (!controlId) {
			res.status(204).send('No control')
			return
		}

		this.#serviceApi.rotateControl(controlId, -1, HTTP_API_SURFACE_ID)

		res.send('ok')
	}

	/**
	 * Perform control rotate right
	 */
	#locationRotateRight = (req: Express.Request, res: Express.Response): void => {
		const parsed = this.#locationParse(req, res)
		if (!parsed) return
		const { location, controlId } = parsed
		this.logger.info(`Got HTTP control rotate right ${formatLocation(location)} - ${controlId}`)

		if (!controlId) {
			res.status(204).send('No control')
			return
		}

		this.#serviceApi.rotateControl(controlId, 1, HTTP_API_SURFACE_ID)

		res.send('ok')
	}

	/**
	 * Set control step
	 */
	#locationStep = (req: Express.Request, res: Express.Response): void => {
		const parsed = this.#locationParse(req, res)
		if (!parsed) return
		const { location, controlId } = parsed
		const stepQuery = StepQuerySchema.safeParse(req.query)
		if (!stepQuery.success) {
			res.status(400).send('Bad step')
			return
		}
		const step = stepQuery.data.step

		this.logger.info(`Got HTTP control step ${formatLocation(location)} - ${controlId} to ${step}`)
		if (!controlId) {
			res.status(204).send('No control')
			return
		}

		const control = this.#serviceApi.getControl(controlId)
		if (!control || !control.setCurrentStep) {
			res.status(204).send('No control')
			return
		}

		if (!control.setCurrentStep(step)) {
			res.status(400).send('Bad step')
			return
		}

		res.send('ok')
	}

	/**
	 * Perform control style change
	 */
	#locationStyle = (req: Express.Request, res: Express.Response): void => {
		const parsed = this.#locationParse(req, res)
		if (!parsed) return
		const { location, controlId } = parsed
		this.logger.info(`Got HTTP control style ${formatLocation(location)} - ${controlId}`)

		if (!controlId) {
			res.status(204).send('No control')
			return
		}

		const control = this.#serviceApi.getControl(controlId)
		if (!control || !control.setStyleFields) {
			res.status(204).send('No control')
			return
		}

		const query = StyleQuerySchema.safeParse(req.query)
		const body = StyleBodySchema.safeParse(req.body && typeof req.body === 'object' ? req.body : {})
		if (!query.success || !body.success) {
			res.status(400).send('Bad style')
			return
		}

		const newFields: Partial<ButtonStyleProperties> = {}

		const bgcolor = query.data.bgcolor || body.data.bgcolor
		if (bgcolor !== undefined) {
			const newColor = parseColorToNumber(bgcolor)
			if (newColor !== false) {
				newFields.bgcolor = newColor
			}
		}

		const fgcolor = query.data.color || body.data.color
		if (fgcolor !== undefined) {
			const newColor = parseColorToNumber(fgcolor)
			if (newColor !== false) {
				newFields.color = newColor
			}
		}

		const size = query.data.size || body.data.size
		if (size !== undefined) {
			const value = size === 'auto' ? 'auto' : typeof size === 'number' ? size : parseInt(size)

			if (!isNaN(Number(value)) || typeof value === 'string') {
				newFields.size = value
			}
		}

		const text = query.data.text ?? body.data.text
		if (text !== undefined) {
			newFields.text = text
		}

		const png64 = query.data.png64 ?? body.data.png64
		if (png64 === '') {
			newFields.png64 = null
		} else if (png64 && png64.match(/data:.*?image\/png/)) {
			newFields.png64 = png64
		}

		const alignment = query.data.alignment || body.data.alignment
		if (alignment) {
			const [, , tmpAlignment] = ParseAlignment(alignment, false)
			newFields.alignment = tmpAlignment
		}

		const pngalignment = query.data.pngalignment || body.data.pngalignment
		if (pngalignment) {
			const [, , tmpAlignment] = ParseAlignment(pngalignment, false)
			newFields.pngalignment = tmpAlignment
		}

		if (Object.keys(newFields).length > 0) {
			control.setStyleFields(newFields)
		}

		// TODO - return style
		res.send('ok')
	}

	/**
	 * Perform custom variable set value
	 */
	#customVariableSetValue = (req: Express.Request, res: Express.Response): void => {
		const variableName = req.params.name
		let variableValue = null
		let variableError = true

		const query = ValueQuerySchema.safeParse(req.query)
		if (!query.success) {
			res.status(400).send('Bad value')
			return
		}

		if (query.data.value !== undefined) {
			variableValue = query.data.value
			variableError = false
		} else if (req.headers['content-type']?.toLowerCase() === 'application/json') {
			if (
				req.body !== undefined &&
				(typeof req.body === 'string' ||
					(typeof req.body === 'object' && Object.keys(req.body).length > 0) ||
					typeof req.body === 'number' ||
					typeof req.body === 'boolean' ||
					typeof req.body === 'bigint')
			) {
				variableValue = req.body
			} else if (typeof req.body === 'object' && Object.keys(req.body).length == 0) {
				variableValue = undefined
			} else {
				variableValue = null
			}
			variableError = false
		} else if (req.body && typeof req.body !== 'object') {
			variableValue = req.body?.toString().trim()
			variableError = false
		}

		this.logger.debug(
			`Got HTTP custom variable set value name "${variableName}" to value ${JSON.stringify(variableValue)}`
		)
		if (variableError) {
			res.status(400).send('No value')
			return
		}

		const result = this.#serviceApi.setCustomVariableValue(variableName, variableValue)
		if (result) {
			res.status(404).send('Not found')
		} else {
			res.send('ok')
		}
	}

	/**
	 * Retrieve a custom variable current value
	 */
	#customVariableGetValue = (req: Express.Request, res: Express.Response): void => {
		const variableName = req.params.name

		this.logger.debug(`Got HTTP custom variable get value name "${variableName}"`)

		const result = this.#serviceApi.getCustomVariableValue(variableName)
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
	#moduleVariableGetValue = (req: Express.Request, res: Express.Response): void => {
		const connectionLabel = req.params.label
		const variableName = req.params.name

		this.logger.debug(`Got HTTP module variable get value name "${connectionLabel}:${variableName}"`)

		const result = this.#serviceApi.getConnectionVariableValue(connectionLabel, variableName)
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
	 * List all connections with their current status
	 */
	#connectionsList = (_req: Express.Request, res: Express.Response): void => {
		this.logger.debug('Got HTTP GET /api/connections')

		const clientConnections = this.#serviceApi.getConnectionsList()
		const connections = Object.entries(clientConnections).map(([id, config]) => {
			const status = this.#serviceApi.getConnectionStatus(id)
			return {
				id,
				label: config.label,
				moduleId: config.moduleId,
				enabled: config.enabled,
				status: status ?? null,
			}
		})

		res.json(connections)
	}

	/**
	 * Get the status of a specific connection
	 */
	#connectionGetStatus = (req: Express.Request, res: Express.Response): void => {
		const connectionId = req.params.id

		const connectionConfig = this.#serviceApi.getConnectionsList()[connectionId]
		if (!connectionConfig) {
			res.status(404).json({ status: 404, message: 'Connection not found' })
			return
		}

		this.logger.debug(`Got HTTP GET /api/connections/${connectionId}/status`)

		const status = this.#serviceApi.getConnectionStatus(connectionId)
		res.json({
			id: connectionId,
			label: connectionConfig.label,
			enabled: connectionConfig.enabled,
			status: status ?? null,
		})
	}

	/**
	 * Restart a connection process
	 */
	#connectionRestart = (req: Express.Request, res: Express.Response): void => {
		const connectionId = req.params.id

		const connectionConfig = this.#serviceApi.getConnectionsList()[connectionId]
		if (!connectionConfig) {
			res.status(404).json({ status: 404, message: 'Connection not found' })
			return
		}

		this.logger.info(`Got HTTP POST /api/connections/${connectionId}/restart`)

		const result = this.#serviceApi.restartConnection(connectionId)
		if (!result) {
			res.status(409).json({ status: 409, message: 'Connection is inactive and cannot be restarted' })
			return
		}

		res.json({ id: connectionId, message: 'Restart triggered' })
	}

	/**
	 * Enable a connection
	 */
	#connectionEnable = (req: Express.Request, res: Express.Response): void => {
		const connectionId = req.params.id

		const connectionConfig = this.#serviceApi.getConnectionsList()[connectionId]
		if (!connectionConfig) {
			res.status(404).json({ status: 404, message: 'Connection not found' })
			return
		}

		this.logger.info(`Got HTTP POST /api/connections/${connectionId}/enable`)

		this.#serviceApi.enableDisableConnection(connectionId, true)
		res.json({ id: connectionId, enabled: true })
	}

	/**
	 * Disable a connection
	 */
	#connectionDisable = (req: Express.Request, res: Express.Response): void => {
		const connectionId = req.params.id

		const connectionConfig = this.#serviceApi.getConnectionsList()[connectionId]
		if (!connectionConfig) {
			res.status(404).json({ status: 404, message: 'Connection not found' })
			return
		}

		this.logger.info(`Got HTTP POST /api/connections/${connectionId}/disable`)

		this.#serviceApi.enableDisableConnection(connectionId, false)
		res.json({ id: connectionId, enabled: false })
	}
}
