import CoreBase from '../Core/Base.js'

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
		super(registry, 'api', 'lib/Service/Api')
	}

	/**
	 * Fire an API command from a raw TCP/UDP command
	 * @param {string} data - the raw command
	 * @param {?unction} response_cb - response data for the client
	 */
	parseApiCommand(data, response_cb) {
		this.debug('API parsing command:', data.trim())
		let command = data.toString()
		let match

		if ((match = command.match(/^page-set (\d+) ([a-z0-9]{3,32})\n?$/i))) {
			let page = parseInt(match[1])
			let deviceid = match[2]
			this.surfaces.devicePageSet(deviceid, page)
			response_cb(null, '+OK Probably?')
		} else if ((match = command.match(/^page-up ([a-z0-9]{3,32})\n?$/i))) {
			let deviceid = match[1]
			this.surfaces.devicePageUp(deviceid)
			response_cb(null, '+OK If ' + deviceid + ' is connected')
		} else if ((match = command.match(/^page-down ([a-z0-9]{3,32})\n?$/i))) {
			let deviceid = match[1]
			this.surfaces.devicePageDown(deviceid)
			response_cb(null, '+OK If ' + deviceid + ' is connected')
		} else if ((match = command.match(/^(bank-press|bank-up|bank-down) (\d+) (\d+)\n?$/i))) {
			let func = match[1].toLowerCase()
			let page = parseInt(match[2])
			let bank = parseInt(match[3])

			if (page > 0 && page <= 99 && bank > 0 && bank <= global.MAX_BUTTONS) {
				this.log('debug', func + ': ' + page + '.' + bank)

				if (func == 'bank-press') {
					this.debug('Got /press/bank/ (trigger)', page, 'button', bank)
					this.bank.action.pressBank(page, bank, true)

					setTimeout(() => {
						this.debug('Auto releasing /press/bank/ (trigger)', page, 'button', bank)
						this.bank.action.pressBank(page, bank, false)
					}, 20)
				} else if (func == 'bank-down') {
					this.bank.action.pressBank(page, bank, true)
				} else if (func == 'bank-up') {
					this.bank.action.pressBank(page, bank, false)
				}

				response_cb(null, '+OK')
			} else {
				response_cb(true, '-ERR Page/bank out of range')
			}
		} else if ((match = command.match(/^style bank (\d+) (\d+) text/i))) {
			//else if (match = command.match(/^style bank (\d+) (\d+) text (.*)\n?$/i)) {
			let page = parseInt(match[1])
			let bank = parseInt(match[2])

			if (page > 0 && page <= 99 && bank > 0 && bank <= global.MAX_BUTTONS) {
				let textMatch
				if ((textMatch = command.match(/^style bank (\d+) (\d+) text (.*)\n?$/i))) {
					console.log('text')
					let text = textMatch[3]
				} else {
					console.log('no text')
					let text = ''
				}

				this.bank.changeField(match[1], match[2], 'text', text)
				response_cb(null, '+OK')
			} else {
				response_cb(true, '-ERR Page/bank out of range')
			}
		} else if ((match = command.match(/^style bank (\d+) (\d+) bgcolor (.*)\n?$/i))) {
			let page = parseInt(match[1])
			let bank = parseInt(match[2])

			if (page > 0 && page <= 99 && bank > 0 && bank <= global.MAX_BUTTONS) {
				let color = rgb(match[3].replace(/#/, '').substr(0, 2), match[3].substr(2, 2), match[3].substr(4, 2), 16)
				if (color !== false) {
					this.bank.changeField(match[1], match[2], 'bgcolor', color)
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

			if (page > 0 && page <= 99 && bank > 0 && bank <= global.MAX_BUTTONS) {
				let color = rgb(match[3].replace(/#/, '').substr(0, 2), match[3].substr(2, 2), match[3].substr(4, 2), 16)
				if (color !== false) {
					this.bank.changeField(match[1], match[2], 'color', color)
					response_cb(null, '+OK')
				} else {
					response_cb(true, '-ERR Syntax error')
				}
			} else {
				response_cb(true, '-ERR Page/bank out of range')
			}
		} else if ((match = command.match(/^rescan\n?$/i))) {
			this.log('debug', 'Rescanning USB')
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
