import CoreBase from '../Core/Base.js'
import RegexRouter from './RegexRouter.js'

/**
 * Common API command processing for {@link ServiceTcp} and {@link ServiceUdp}.
 *
 * @extends CoreBase
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
class ServiceApi extends CoreBase {
	/**
	 * Message router
	 * @type {RegexRouter}
	 * @access private
	 */
	#router

	/**
	 * @param {import('../Registry.js').default} registry - the core registry
	 */
	constructor(registry) {
		super(registry, 'api', 'Service/Api')

		this.#router = new RegexRouter(() => {
			throw new ApiMessageError('Syntax error')
		})
		this.#setupRoutes()
	}

	#setupRoutes() {
		this.#router.addPath('page-set :page(\\d+) :deviceId', (match) => {
			const page = parseInt(match.page)
			const deviceId = match.deviceId

			this.surfaces.devicePageSet(deviceId, page)

			return `If ${deviceId} is connected`
		})

		this.#router.addPath('page-up :deviceId', (match) => {
			const deviceId = match.deviceId

			this.surfaces.devicePageUp(deviceId)

			return `If ${deviceId} is connected`
		})

		this.#router.addPath('page-down :deviceId', (match) => {
			const deviceId = match.deviceId

			this.surfaces.devicePageDown(deviceId)

			return `If ${deviceId} is connected`
		})

		this.#router.addPath('bank-press :page(\\d+) :bank(\\d+)', (match) => {
			const controlId = this.page.getControlIdAtOldBankIndex(Number(match.page), Number(match.bank))
			if (!controlId) throw new ApiMessageError('Page/bank out of range')

			this.logger.info(`Got bank-press (trigger) ${controlId}`)

			if (!this.controls.pressControl(controlId, true, undefined)) {
				throw new ApiMessageError('Control does not support presses')
			}

			setTimeout(() => {
				this.logger.info(`Auto releasing bank-press ${controlId}`)
				this.controls.pressControl(controlId, false, undefined)
			}, 20)
		})

		this.#router.addPath('bank-down :page(\\d+) :bank(\\d+)', (match) => {
			const controlId = this.page.getControlIdAtOldBankIndex(Number(match.page), Number(match.bank))
			if (!controlId) throw new ApiMessageError('Page/bank out of range')

			this.logger.info(`Got bank-down (trigger) ${controlId}`)

			if (!this.controls.pressControl(controlId, true, undefined)) {
				throw new ApiMessageError('Control does not support presses')
			}
		})

		this.#router.addPath('bank-up :page(\\d+) :bank(\\d+)', (match) => {
			const controlId = this.page.getControlIdAtOldBankIndex(Number(match.page), Number(match.bank))
			if (!controlId) throw new ApiMessageError('Page/bank out of range')

			this.logger.info(`Got bank-up (trigger) ${controlId}`)

			if (!this.controls.pressControl(controlId, false, undefined)) {
				throw new ApiMessageError('Control does not support presses')
			}
		})

		this.#router.addPath('bank-step :page(\\d+) :bank(\\d+) :step(\\d+)', (match) => {
			const controlId = this.page.getControlIdAtOldBankIndex(Number(match.page), Number(match.bank))
			if (!controlId) throw new ApiMessageError('Page/bank out of range')

			const step = Number(match.step)

			this.logger.info(`Got bank-step (trigger) ${controlId} ${step}`)

			if (isNaN(step) || step <= 0) throw new ApiMessageError('Step out of range')

			const control = this.controls.getControl(controlId)
			if (!control || !control.supportsSteps) throw new ApiMessageError('Invalid control')

			if (!control.stepMakeCurrent(step)) throw new ApiMessageError('Step out of range')
		})

		this.#router.addPath('style bank :page(\\d+) :bank(\\d+) text{ :text}?', (match) => {
			const controlId = this.page.getControlIdAtOldBankIndex(Number(match.page), Number(match.bank))
			if (!controlId) throw new ApiMessageError('Page/bank out of range')

			const control = controlId && this.controls.getControl(controlId)

			if (control && control.supportsStyle) {
				const text = match.text || ''

				control.styleSetFields({ text: text })
			} else {
				throw new ApiMessageError('Page/bank out of range')
			}
		})

		this.#router.addPath('style bank :page(\\d+) :bank(\\d+) bgcolor #:color([a-f\\d]+)', (match) => {
			const controlId = this.page.getControlIdAtOldBankIndex(Number(match.page), Number(match.bank))
			if (!controlId) throw new ApiMessageError('Page/bank out of range')

			const color = parseInt(match.color, 16)
			if (isNaN(color)) throw new ApiMessageError('Invalid color')

			const control = controlId && this.controls.getControl(controlId)

			if (control && control.supportsStyle) {
				control.styleSetFields({ bgcolor: color })
			} else {
				throw new ApiMessageError('Page/bank out of range')
			}
		})

		this.#router.addPath('style bank :page(\\d+) :bank(\\d+) color #:color([a-f\\d]+)', (match) => {
			const controlId = this.page.getControlIdAtOldBankIndex(Number(match.page), Number(match.bank))
			if (!controlId) throw new ApiMessageError('Page/bank out of range')

			const color = parseInt(match.color, 16)
			if (isNaN(color)) throw new ApiMessageError('Invalid color')

			const control = controlId && this.controls.getControl(controlId)

			if (control && control.supportsStyle) {
				control.styleSetFields({ color: color })
			} else {
				throw new ApiMessageError('Page/bank out of range')
			}
		})

		this.#router.addPath('rescan', async () => {
			this.logger.debug('Rescanning USB')

			try {
				await this.surfaces.triggerRefreshDevices()
			} catch (e) {
				throw new ApiMessageError('Scan failed')
			}
		})

		this.#router.addPath('custom-variable :name set-value :value(.*)', async (match) => {
			const result = this.instance.variable.custom.setValue(match.name, match.value)
			if (result) {
				throw new ApiMessageError(result)
			}
		})
	}

	/**
	 * Fire an API command from a raw TCP/UDP command
	 * @param {string} data - the raw command
	 * @returns {Promise<string>}
	 */
	async parseApiCommand(data) {
		data = data.trim()
		this.logger.silly(`API parsing command: ${data}`)

		return this.#router.processMessage(data)
	}
}

export class ApiMessageError extends Error {
	/**
	 * @param {string} message
	 */
	constructor(message) {
		super(message)
	}
}

export default ServiceApi
