import CoreBase from '../Core/Base.js'
import { CreateBankControlId } from '../Resources/Util.js'

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
	 * @param {Registry} registry - the core registry
	 */
	constructor(registry) {
		super(registry, 'api', 'Service/Api')
	}

	/**
	 * Fire an API command from a raw TCP/UDP command
	 * @param {string} data - the raw command
	 * @param {?unction} response_cb - response data for the client
	 */
	parseApiCommand(data, response_cb) {
		this.logger.silly(`API parsing command: ${data.trim()}`)
		let command = data.toString()
		let match

		if ((match = command.match(/^page-set (\d+) ([a-z0-9]{3,32})\n?$/i))) {
			let page = parseInt(match[1])
			let deviceId = match[2]

			this.surfaces.devicePageSet(deviceId, page)

			response_cb(null, `+OK If ${deviceId} is connected`)
		} else if ((match = command.match(/^page-up ([a-z0-9]{3,32})\n?$/i))) {
			let deviceId = match[1]

			this.surfaces.devicePageUp(deviceId)

			response_cb(null, `+OK If ${deviceId} is connected`)
		} else if ((match = command.match(/^page-down ([a-z0-9]{3,32})\n?$/i))) {
			let deviceId = match[1]

			this.surfaces.devicePageDown(deviceId)

			response_cb(null, `+OK If ${deviceId} is connected`)
		} else if ((match = command.match(/^(bank-press|bank-up|bank-down) (\d+) (\d+)\n?$/i))) {
			let func = match[1].toLowerCase()
			let page = parseInt(match[2])
			let bank = parseInt(match[3])

			const controlId = CreateBankControlId(page, bank)
			if (page > 0 && page <= 99 && bank > 0 && bank <= global.MAX_BUTTONS) {
				this.logger.debug(`API: ${func}: ${controlId}`)

				if (func == 'bank-press') {
					this.logger.info(`Got bank-press (trigger) ${controlId}`)

					this.controls.pressControl(controlId, true)

					setTimeout(() => {
						this.logger.info(`Auto releasing bank-press ${controlId}`)
						this.controls.pressControl(controlId, false)
					}, 20)
				} else if (func == 'bank-down') {
					this.logger.info(`Got bank-down (trigger) ${controlId}`)

					this.controls.pressControl(controlId, true)
				} else if (func == 'bank-up') {
					this.logger.info(`Got bank-up (trigger) ${controlId}`)

					this.controls.pressControl(controlId, false)
				}

				response_cb(null, '+OK')
			} else {
				response_cb(true, '-ERR Page/bank out of range')
			}
		} else if ((match = command.match(/^style bank (\d+) (\d+) text/i))) {
			//else if (match = command.match(/^style bank (\d+) (\d+) text (.*)\n?$/i)) {
			let page = parseInt(match[1])
			let bank = parseInt(match[2])

			const controlId = CreateBankControlId(page, bank)
			const control = this.controls.getControl(controlId)

			if (control && typeof control.styleSetFields === 'function') {
				const textMatch = command.match(/^style bank (\d+) (\d+) text (.*)\n?$/i)
				const text = textMatch ? textMatch[3] : ''

				control.styleSetFields({ text: text })

				response_cb(null, '+OK')
			} else {
				response_cb(true, '-ERR Page/bank out of range')
			}
		} else if ((match = command.match(/^style bank (\d+) (\d+) bgcolor (.*)\n?$/i))) {
			let page = parseInt(match[1])
			let bank = parseInt(match[2])

			const controlId = CreateBankControlId(page, bank)
			const control = this.controls.getControl(controlId)

			if (control && typeof control.styleSetFields === 'function') {
				const color = parseInt(match[3].replace(/#/, ''), 16)
				if (!isNaN(color)) {
					control.styleSetFields({ bgcolor: color })
					response_cb(null, '+OK')
				} else {
					response_cb(true, '-ERR Syntax error')
				}
			} else {
				response_cb(true, '-ERR Page/bank out of range')
			}
		} else if ((match = command.match(/^style bank (\d+) (\d+) color (.*)\n?$/i))) {
			let page = parseInt(match[1])
			let bank = parseInt(match[2])

			const controlId = CreateBankControlId(page, bank)
			const control = this.controls.getControl(controlId)

			if (control && typeof control.styleSetFields === 'function') {
				const color = parseInt(match[3].replace(/#/, ''), 16)
				if (!isNaN(color)) {
					control.styleSetFields({ color: color })
					response_cb(null, '+OK')
				} else {
					response_cb(true, '-ERR Syntax error')
				}
			} else {
				response_cb(true, '-ERR Page/bank out of range')
			}
		} else if ((match = command.match(/^rescan\n?$/i))) {
			this.logger.debug('Rescanning USB')
			this.surfaces.refreshDevices().then(
				() => {
					response_cb(null, '+OK')
				},
				(e) => {
					response_cb(true, '-ERR Scan failed')
				}
			)
		} else {
			response_cb(true, '-ERR Syntax error')
		}
	}
}

export default ServiceApi
