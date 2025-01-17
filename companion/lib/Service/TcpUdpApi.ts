import { CoreBase } from '../Core/Base.js'
import { parseColorToNumber } from '../Resources/Util.js'
import { formatLocation } from '@companion-app/shared/ControlId.js'
import { RegexRouter } from './RegexRouter.js'
import type { ControlLocation } from '@companion-app/shared/Model/Common.js'
import type { Registry } from '../Registry.js'
import type { UserConfigModel } from '@companion-app/shared/Model/UserConfigModel.js'

/**
 * Common API command processing for {@link ServiceTcp} and {@link ServiceUdp}.
 *
 * @author Håkon Nessjøen <haakon@bitfocus.io>
 * @author Keith Rocheck <keith.rocheck@gmail.com>
 * @author William Viker <william@bitfocus.io>
 * @author Julian Waller <me@julusian.co.uk>
 * @since 1.3.0
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
export class ServiceTcpUdpApi extends CoreBase {
	/**
	 * Message router
	 */
	readonly #router: RegexRouter

	/**
	 * Protocol name
	 */
	readonly #protocolName: string

	/**
	 * Userconfig key to enable/disable legacy routes
	 */
	readonly #legacyRoutesEnableKey: keyof UserConfigModel | null

	get router(): RegexRouter {
		return this.#router
	}

	/**
	 * @param registry - the core registry
	 * @param protocolName - the protocol name
	 * @param legacyRoutesEnableKey - Userconfig key to enable/disable legacy routes
	 */
	constructor(registry: Registry, protocolName: string, legacyRoutesEnableKey: keyof UserConfigModel | null) {
		super(registry, 'Service/Api')

		this.#router = new RegexRouter(() => {
			throw new ApiMessageError('Syntax error')
		})
		this.#protocolName = protocolName
		this.#legacyRoutesEnableKey = legacyRoutesEnableKey

		this.#setupLegacyRoutes()
		this.#setupNewRoutes()
	}

	#checkLegacyRouteAllowed() {
		if (this.#legacyRoutesEnableKey && !this.userconfig.getKey(this.#legacyRoutesEnableKey)) {
			throw new ApiMessageError('Deprecated commands are disabled')
		}
	}

	#setupLegacyRoutes() {
		this.#router.addPath('page-set :page :surfaceId', (match) => {
			this.#checkLegacyRouteAllowed()

			const page = Number(match.page)
			const surfaceId = match.surfaceId

			const pageId = this.page.getPageInfo(page)?.id
			if (!pageId) return 'Page not found'

			this.surfaces.devicePageSet(surfaceId, pageId)

			return `If ${surfaceId} is connected`
		})

		this.#router.addPath('page-up :surfaceId', (match) => {
			this.#checkLegacyRouteAllowed()

			const surfaceId = match.surfaceId

			this.surfaces.devicePageUp(surfaceId)

			return `If ${surfaceId} is connected`
		})

		this.#router.addPath('page-down :surfaceId', (match) => {
			this.#checkLegacyRouteAllowed()

			const surfaceId = match.surfaceId

			this.surfaces.devicePageDown(surfaceId)

			return `If ${surfaceId} is connected`
		})

		this.#router.addPath('bank-press :page :bank', (match) => {
			this.#checkLegacyRouteAllowed()

			const controlId = this.page.getControlIdAtOldBankIndex(Number(match.page), Number(match.bank))
			if (!controlId) throw new ApiMessageError('Page/bank out of range')

			this.logger.info(`Got bank-press (trigger) ${controlId}`)

			if (!this.controls.pressControl(controlId, true, this.#protocolName)) {
				throw new ApiMessageError('Page/bank out of range')
			}

			setTimeout(() => {
				this.logger.info(`Auto releasing bank-press ${controlId}`)
				this.controls.pressControl(controlId, false, this.#protocolName)
			}, 20)
		})

		this.#router.addPath('bank-down :page :bank', (match) => {
			this.#checkLegacyRouteAllowed()

			const controlId = this.page.getControlIdAtOldBankIndex(Number(match.page), Number(match.bank))
			if (!controlId) throw new ApiMessageError('Page/bank out of range')

			this.logger.info(`Got bank-down (trigger) ${controlId}`)

			if (!this.controls.pressControl(controlId, true, this.#protocolName)) {
				throw new ApiMessageError('Page/bank out of range')
			}
		})

		this.#router.addPath('bank-up :page :bank', (match) => {
			this.#checkLegacyRouteAllowed()

			const controlId = this.page.getControlIdAtOldBankIndex(Number(match.page), Number(match.bank))
			if (!controlId) throw new ApiMessageError('Page/bank out of range')

			this.logger.info(`Got bank-up (trigger) ${controlId}`)

			if (!this.controls.pressControl(controlId, false, this.#protocolName)) {
				throw new ApiMessageError('Page/bank out of range')
			}
		})

		this.#router.addPath('bank-step :page :bank :step', (match) => {
			this.#checkLegacyRouteAllowed()

			const controlId = this.page.getControlIdAtOldBankIndex(Number(match.page), Number(match.bank))
			if (!controlId) throw new ApiMessageError('Page/bank out of range')

			const step = Number(match.step)

			this.logger.info(`Got bank-step (trigger) ${controlId} ${step}`)

			if (isNaN(step) || step <= 0) throw new ApiMessageError('Step out of range')

			const control = this.controls.getControl(controlId)
			if (!control || !control.supportsActionSets) throw new ApiMessageError('Invalid control')

			if (!control.actionSets.stepMakeCurrent(step)) throw new ApiMessageError('Step out of range')
		})

		this.#router.addPath('style bank :page :bank text{ *text}', (match) => {
			this.#checkLegacyRouteAllowed()

			const controlId = this.page.getControlIdAtOldBankIndex(Number(match.page), Number(match.bank))
			if (!controlId) throw new ApiMessageError('Page/bank out of range')

			const control = this.controls.getControl(controlId)

			if (control && control.supportsStyle) {
				const text = match.text || ''

				control.styleSetFields({ text: text })
			} else {
				throw new ApiMessageError('Page/bank out of range')
			}
		})

		this.#router.addPath('style bank :page :bank bgcolor #:color', (match) => {
			this.#checkLegacyRouteAllowed()

			const controlId = this.page.getControlIdAtOldBankIndex(Number(match.page), Number(match.bank))
			if (!controlId) throw new ApiMessageError('Page/bank out of range')

			const color = parseInt(match.color, 16)
			if (isNaN(color)) throw new ApiMessageError('Invalid color')

			const control = this.controls.getControl(controlId)

			if (control && control.supportsStyle) {
				control.styleSetFields({ bgcolor: color })
			} else {
				throw new ApiMessageError('Page/bank out of range')
			}
		})

		this.#router.addPath('style bank :page :bank color #:color', (match) => {
			this.#checkLegacyRouteAllowed()

			const controlId = this.page.getControlIdAtOldBankIndex(Number(match.page), Number(match.bank))
			if (!controlId) throw new ApiMessageError('Page/bank out of range')

			const color = parseInt(match.color, 16)
			if (isNaN(color)) throw new ApiMessageError('Invalid color')

			const control = this.controls.getControl(controlId)

			if (control && control.supportsStyle) {
				control.styleSetFields({ color: color })
			} else {
				throw new ApiMessageError('Page/bank out of range')
			}
		})

		this.#router.addPath('rescan', async () => {
			this.#checkLegacyRouteAllowed()

			this.logger.debug('Rescanning USB')

			try {
				await this.surfaces.triggerRefreshDevices()
			} catch (e) {
				throw new ApiMessageError('Scan failed')
			}
		})
	}

	#setupNewRoutes() {
		// surface pages
		this.#router.addPath('surface :surfaceId page-set :page', this.#surfaceSetPage)
		this.#router.addPath('surface :surfaceId page-up', this.#surfacePageUp)
		this.#router.addPath('surface :surfaceId page-down', this.#surfacePageDown)

		// control by location
		this.#router.addPath('location :page/:row/:column press', this.#locationPress)
		this.#router.addPath('location :page/:row/:column down', this.#locationDown)
		this.#router.addPath('location :page/:row/:column up', this.#locationUp)
		this.#router.addPath('location :page/:row/:column rotate-left', this.#locationRotateLeft)
		this.#router.addPath('location :page/:row/:column rotate-right', this.#locationRotateRight)
		this.#router.addPath('location :page/:row/:column set-step :step', this.#locationSetStep)

		this.#router.addPath('location :page/:row/:column style text{ *text}', this.#locationStyleText)
		this.#router.addPath('location :page/:row/:column style color :color', this.#locationStyleColor)
		this.#router.addPath('location :page/:row/:column style bgcolor :bgcolor', this.#locationStyleBgcolor)

		// surfaces
		this.#router.addPath('surfaces rescan', this.#surfacesRescan)

		// custom variables
		this.#router.addPath('custom-variable :name set-value {*value}', this.#customVariableSetValue)
	}

	/**
	 * Perform surface set to page
	 */
	#surfaceSetPage = (match: Record<string, string>): string => {
		const page = Number(match.page)
		const surfaceId = match.surfaceId

		const pageId = this.page.getPageInfo(page)?.id
		if (!pageId) return 'Page not found'

		this.surfaces.devicePageSet(surfaceId, pageId)

		return `If ${surfaceId} is connected`
	}

	/**
	 * Perform surface page up
	 */
	#surfacePageUp = (match: Record<string, string>): string => {
		const surfaceId = match.surfaceId

		this.surfaces.devicePageUp(surfaceId)

		return `If ${surfaceId} is connected`
	}

	/**
	 * Perform surface page down
	 */
	#surfacePageDown = (match: Record<string, string>): string => {
		const surfaceId = match.surfaceId

		this.surfaces.devicePageDown(surfaceId)

		return `If ${surfaceId} is connected`
	}

	/**
	 * Perform control press
	 */
	#locationPress = (match: Record<string, string>): void => {
		const { location, controlId } = this.#locationParse(match)

		this.logger.info(`Got location press at ${formatLocation(location)} (${controlId})`)

		if (!controlId || !this.controls.pressControl(controlId, true, this.#protocolName)) {
			throw new ApiMessageError('No control at location')
		}

		setTimeout(() => {
			this.logger.info(`Auto releasing ${formatLocation(location)} (${controlId})`)
			this.controls.pressControl(controlId, false, this.#protocolName)
		}, 20)
	}

	/**
	 * Perform control down
	 */
	#locationDown = (match: Record<string, string>): void => {
		const { location, controlId } = this.#locationParse(match)

		this.logger.info(`Got location down at ${formatLocation(location)} (${controlId})`)

		if (!controlId || !this.controls.pressControl(controlId, true, this.#protocolName)) {
			throw new ApiMessageError('No control at location')
		}
	}

	/**
	 * Perform control up
	 */
	#locationUp = (match: Record<string, string>): void => {
		const { location, controlId } = this.#locationParse(match)

		this.logger.info(`Got location up at ${formatLocation(location)} (${controlId})`)

		if (!controlId || !this.controls.pressControl(controlId, false, this.#protocolName)) {
			throw new ApiMessageError('No control at location')
		}
	}

	/**
	 * Perform control rotate left
	 */
	#locationRotateLeft = (match: Record<string, string>): void => {
		const { location, controlId } = this.#locationParse(match)

		this.logger.info(`Got location rotate-left at ${formatLocation(location)} (${controlId})`)

		if (!controlId || !this.controls.rotateControl(controlId, false, this.#protocolName)) {
			throw new ApiMessageError('No control at location')
		}
	}

	/**
	 * Perform control rotate right
	 */
	#locationRotateRight = (match: Record<string, string>): void => {
		const { location, controlId } = this.#locationParse(match)

		this.logger.info(`Got location rotate-right at ${formatLocation(location)} (${controlId})`)

		if (!controlId || !this.controls.rotateControl(controlId, true, this.#protocolName)) {
			throw new ApiMessageError('No control at location')
		}
	}

	/**
	 * Set control step
	 */
	#locationSetStep = (match: Record<string, string>): void => {
		const step = Number(match.step)
		const { location, controlId } = this.#locationParse(match)

		this.logger.info(`Got location set-step at ${formatLocation(location)} (${controlId}) to ${step}`)
		if (!controlId) {
			throw new ApiMessageError('No control at location')
		}

		const control = this.controls.getControl(controlId)
		if (!control || !control.supportsActionSets) {
			throw new ApiMessageError('No control at location')
		}

		if (!control.actionSets.stepMakeCurrent(step)) throw new ApiMessageError('Step out of range')
	}

	/**
	 * Perform control style text change
	 */
	#locationStyleText = (match: Record<string, string>): void => {
		const { location, controlId } = this.#locationParse(match)

		this.logger.info(`Got location style text at ${formatLocation(location)} (${controlId}) `)
		if (!controlId) {
			throw new ApiMessageError('No control at location')
		}

		const control = this.controls.getControl(controlId)
		if (control && control.supportsStyle) {
			const text = match.text || ''

			control.styleSetFields({ text: text })
		} else {
			throw new ApiMessageError('No control at location')
		}
	}

	/**
	 * Perform control style color change
	 */
	#locationStyleColor = (match: Record<string, string>): void => {
		const { location, controlId } = this.#locationParse(match)

		this.logger.info(`Got location style color at ${formatLocation(location)} (${controlId}) `)
		if (!controlId) {
			throw new ApiMessageError('No control at location')
		}

		const control = this.controls.getControl(controlId)
		if (control && control.supportsStyle) {
			const color = parseColorToNumber(match.color)

			control.styleSetFields({ color: color })
		} else {
			throw new ApiMessageError('No control at location')
		}
	}

	/**
	 * Perform control style bgcolor change
	 */
	#locationStyleBgcolor = (match: Record<string, string>): void => {
		const { location, controlId } = this.#locationParse(match)

		this.logger.info(`Got location style bgcolor at ${formatLocation(location)} (${controlId}) `)
		if (!controlId) {
			throw new ApiMessageError('No control at location')
		}

		const control = this.controls.getControl(controlId)
		if (control && control.supportsStyle) {
			const color = parseColorToNumber(match.bgcolor)

			control.styleSetFields({ bgcolor: color })
		} else {
			throw new ApiMessageError('No control at location')
		}
	}

	/**
	 * Perform surfaces rescan
	 */
	#surfacesRescan = async (_match: Record<string, string>): Promise<void> => {
		this.logger.debug('Rescanning USB')

		try {
			await this.surfaces.triggerRefreshDevices()
		} catch (e) {
			throw new ApiMessageError('Scan failed')
		}
	}

	/**
	 * Perform custom variable set value
	 */
	#customVariableSetValue = (match: Record<string, string>): void => {
		const result = this.variablesController.custom.setValue(match.name, match.value ?? '')
		if (result) {
			throw new ApiMessageError(result)
		}
	}

	/**
	 * Parse the location and controlId from a request
	 */
	#locationParse = (match: Record<string, string>): { location: ControlLocation; controlId: string | null } => {
		const location = {
			pageNumber: Number(match.page),
			row: Number(match.row),
			column: Number(match.column),
		}

		if (isNaN(location.pageNumber) || isNaN(location.row) || isNaN(location.column))
			// Match previous behaviour
			throw new ApiMessageError('Syntax error')

		const controlId = this.page.getControlIdAt(location)

		return {
			location,
			controlId,
		}
	}

	/**
	 * Fire an API command from a raw TCP/UDP command
	 */
	async parseApiCommand(data: string): Promise<string | undefined | void> {
		data = data.trim()
		this.logger.silly(`API parsing command: ${data}`)

		return this.#router.processMessage(data)
	}
}

export class ApiMessageError extends Error {
	constructor(message: string) {
		super(message)
	}
}
