/*
 * This file is part of the Companion project
 * Copyright (c) 2018 Bitfocus AS
 * Authors: William Viker <william@bitfocus.io>, Håkon Nessjøen <haakon@bitfocus.io>
 *
 * This program is free software.
 * You should have received a copy of the MIT licence as well as the Bitfocus
 * Individual Contributor License Agreement for companion along with
 * this program.
 *
 * You can be released from the requirements of the license by purchasing
 * a commercial license. Buying such a license is mandatory as soon as you
 * develop commercial activities involving the Companion software without
 * disclosing the source code of your own applications.
 *
 */

const debug = require('debug')('lib/Service/Api')
const CoreBase = require('../Core/Base')

function rgb(r, g, b) {
	r = parseInt(r, 16)
	g = parseInt(g, 16)
	b = parseInt(b, 16)

	if (isNaN(r) || isNaN(g) || isNaN(b)) return false
	return ((r & 0xff) << 16) | ((g & 0xff) << 8) | (b & 0xff)
}

class ServiceApi extends CoreBase {
	constructor(registry) {
		super(registry, 'api')
	}

	parseApiCommand(data, response_cb) {
		debug('API parsing command:', data.trim())

		if (response_cb === undefined || typeof response_cb != 'function') {
			return
		}

		const command = data.toString()
		let match

		if ((match = command.match(/^page-set (\d+) ([a-z0-9]{3,32})\n?$/i))) {
			let page = parseInt(match[1])
			let deviceid = match[2]
			this.system.emit('device_page_set', deviceid, page)
			response_cb(null, '+OK Probably?')
		} else if ((match = command.match(/^page-up ([a-z0-9]{3,32})\n?$/i))) {
			let deviceid = match[1]
			this.system.emit('device_page_up', deviceid)
			response_cb(null, '+OK If ' + deviceid + ' is connected')
		} else if ((match = command.match(/^page-down ([a-z0-9]{3,32})\n?$/i))) {
			let deviceid = match[1]
			this.system.emit('device_page_down', deviceid)
			response_cb(null, '+OK If ' + deviceid + ' is connected')
		} else if ((match = command.match(/^(bank-press|bank-up|bank-down) (\d+) (\d+)\n?$/i))) {
			let func = match[1].toLowerCase()
			let page = parseInt(match[2])
			let bank = parseInt(match[3])

			if (page > 0 && page <= 99 && bank > 0 && bank <= global.MAX_BUTTONS) {
				this.log('debug', func + ': ' + page + '.' + bank)

				if (func == 'bank-press') {
					debug('Got /press/bank/ (trigger)', page, 'button', bank)
					this.system.emit('bank_pressed', page, bank, true)

					setTimeout(() => {
						debug('Auto releasing /press/bank/ (trigger)', page, 'button', bank)
						this.system.emit('bank_pressed', page, bank, false)
					}, 20)
				} else if (func == 'bank-down') {
					this.system.emit('bank_pressed', page, bank, true)
				} else if (func == 'bank-up') {
					this.system.emit('bank_pressed', page, bank, false)
				}

				response_cb(null, '+OK')
			} else {
				response_cb(true, '-ERR Page/bank out of range')
			}
		} else if ((match = command.match(/^style bank (\d+) (\d+) text/i))) {
			//else if (match = command.match(/^style bank (\d+) (\d+) text (.*)\n?$/i)) {
			var page = parseInt(match[1])
			var bank = parseInt(match[2])

			if (page > 0 && page <= 99 && bank > 0 && bank <= global.MAX_BUTTONS) {
				var textMatch

				if ((textMatch = command.match(/^style bank (\d+) (\d+) text (.*)\n?$/i))) {
					console.log('text')
					var text = textMatch[3]
				} else {
					console.log('no text')
					var text = ''
				}

				this.system.emit('bank_set_key', match[1], match[2], 'text', text)
				this.system.emit('graphics_bank_invalidate', match[1], match[2])
				response_cb(null, '+OK')
			} else {
				response_cb(true, '-ERR Page/bank out of range')
			}
		} else if ((match = command.match(/^style bank (\d+) (\d+) bgcolor (.*)\n?$/i))) {
			var page = parseInt(match[1])
			var bank = parseInt(match[2])

			if (page > 0 && page <= 99 && bank > 0 && bank <= global.MAX_BUTTONS) {
				var color = rgb(match[3].replace(/#/, '').substr(0, 2), match[3].substr(2, 2), match[3].substr(4, 2))

				if (color !== false) {
					this.system.emit('bank_set_key', match[1], match[2], 'bgcolor', color)
					this.system.emit('graphics_bank_invalidate', match[1], match[2])
					response_cb(null, '+OK')
				} else {
					response_cb(true, '-ERR Syntax error')
				}
			} else {
				response_cb(true, '-ERR Page/bank out of range')
			}
		} else if ((match = command.match(/^style bank (\d+) (\d+) color (.*)\n?$/i))) {
			var page = parseInt(match[1])
			var bank = parseInt(match[2])

			if (page > 0 && page <= 99 && bank > 0 && bank <= global.MAX_BUTTONS) {
				var color = rgb(match[3].replace(/#/, '').substr(0, 2), match[3].substr(2, 2), match[3].substr(4, 2))

				if (color !== false) {
					this.system.emit('bank_set_key', match[1], match[2], 'color', color)
					this.system.emit('graphics_bank_invalidate', match[1], match[2])
					response_cb(null, '+OK')
				} else {
					response_cb(true, '-ERR Syntax error')
				}
			} else {
				response_cb(true, '-ERR Page/bank out of range')
			}
		} else {
			response_cb(true, '-ERR Syntax error')
		}
	}
}

exports = module.exports = ServiceApi
