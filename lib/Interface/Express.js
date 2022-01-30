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

const Express = require('express')
const path = require('path')
const { rgb } = require('../Resources/Util')
const cors = require('cors')

let electron
try {
	electron = require('electron')
} catch (_e) {
	// Doesnt matter
}

exports = module.exports = function (system) {
	return new InterfaceExpress(system)
}

class InterfaceExpress extends Express {
	debug = require('debug')('lib/Interface/Express')

	constructor(system) {
		super()

		const maxAge = process.env.PRODUCTION ? 3600000 : 0

		this.use(cors())

		this.use(function (req, res, next) {
			res.set('X-App', 'Bitfocus AS')
			next()
		})

		this.use('/int', function (req, res, next) {
			let handeled = false

			let timeout = setTimeout(function () {
				handeled = true
				try {
					res.status(404)
					res.send('Not found')
				} catch (e) {
					// Ignore
					res.end()
				}
			}, 2000)

			system.emit('http_req', req, res, function () {
				if (!handeled) {
					clearTimeout(timeout)
					handeled = true
				}
			})
		})

		// Serve docs folder as static and public
		this.use(
			'/docs',
			Express.static(path.join(__dirname, '/../docs'), {
				dotfiles: 'ignore',
				etag: true,
				extensions: ['json', 'md'],
				maxAge: maxAge,
				redirect: false,
			})
		)

		this.options('/press/bank/*', function (req, res, next) {
			res.header('Access-Control-Allow-Origin', '*')
			res.header('Access-Control-Allow-Methods', 'GET,OPTIONS')
			res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Content-Length, X-Requested-With')
			res.send(200)
		})

		this.get('^/press/bank/:page([0-9]{1,2})/:bank([0-9]{1,2})', function (req, res) {
			res.header('Access-Control-Allow-Origin', '*')
			res.header('Access-Control-Allow-Methods', 'GET,OPTIONS')
			res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Content-Length, X-Requested-With')

			this.debug('Got HTTP /press/bank/ (trigger) page ', req.params.page, 'button', req.params.bank)
			system.emit('bank_pressed', req.params.page, req.params.bank, true)

			setTimeout(function () {
				this.debug('Auto releasing HTTP /press/bank/ page ', req.params.page, 'button', req.params.bank)
				system.emit('bank_pressed', req.params.page, req.params.bank, false)
			}, 20)

			res.send('ok')
		})

		this.get('^/press/bank/:page([0-9]{1,2})/:bank([0-9]{1,2})/:direction(down|up)', function (req, res) {
			res.header('Access-Control-Allow-Origin', '*')
			res.header('Access-Control-Allow-Methods', 'GET,OPTIONS')
			res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Content-Length, X-Requested-With')

			if (req.params.direction == 'down') {
				this.debug('Got HTTP /press/bank/ (DOWN) page ', req.params.page, 'button', req.params.bank)
				system.emit('bank_pressed', req.params.page, req.params.bank, true)
			} else {
				this.debug('Got HTTP /press/bank/ (UP) page ', req.params.page, 'button', req.params.bank)
				system.emit('bank_pressed', req.params.page, req.params.bank, false)
			}

			res.send('ok')
		})

		this.get('^/rescan', function (req, res) {
			res.header('Access-Control-Allow-Origin', '*')
			res.header('Access-Control-Allow-Methods', 'GET,OPTIONS')
			res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Content-Length, X-Requested-With')

			this.debug('Got HTTP /rescan')
			system.emit('log', 'HTTP Server', 'debug', 'Rescanning USB')
			system.emit('devices_reenumerate')
			res.send('ok')
		})

		this.get('^/style/bank/:page([0-9]{1,2})/:bank([0-9]{1,2})', function (req, res) {
			res.header('Access-Control-Allow-Origin', '*')
			res.header('Access-Control-Allow-Methods', 'GET,OPTIONS')
			res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Content-Length, X-Requested-With')

			this.debug('Got HTTP /style/bank ', req.params.page, 'button', req.params.bank)

			let responseStatus = 'ok'

			function validateAlign(data) {
				data = data.toLowerCase().split(':')
				const hValues = ['left', 'center', 'right']
				const vValues = ['top', 'center', 'bottom']
				return hValues.includes(data[0]) && vValues.includes(data[1])
			}

			if (req.query.bgcolor) {
				const value = req.query.bgcolor.replace(/#/, '')
				const color = rgb(value.substr(0, 2), value.substr(2, 2), value.substr(4, 2))
				if (color !== false) system.emit('bank_set_key', req.params.page, req.params.bank, 'bgcolor', color)
			}

			if (req.query.color) {
				const value = req.query.color.replace(/#/, '')
				const color = rgb(value.substr(0, 2), value.substr(2, 2), value.substr(4, 2))
				if (color !== false) system.emit('bank_set_key', req.params.page, req.params.bank, 'color', color)
			}

			if (req.query.size) {
				const value = req.query.size.replace(/pt/i, '')
				system.emit('bank_set_key', req.params.page, req.params.bank, 'size', value)
			}

			if (req.query.text || req.query.text === '') {
				system.emit('bank_set_key', req.params.page, req.params.bank, 'text', req.query.text)
			}

			if (req.query.png64 || req.query.png64 === '') {
				if (req.query.png64 === '') {
					system.emit('bank_set_key', req.params.page, req.params.bank, 'png64', undefined)
				} else if (!req.query.png64.match(/data:.*?image\/png/)) {
					responseStatus = 'png64 must be a base64 encoded png file'
				} else {
					const data = req.query.png64.replace(/^.*base64,/, '')
					system.emit('bank_set_key', req.params.page, req.params.bank, 'png64', data)
				}
			}

			if (req.query.alignment && validateAlign(req.query.alignment)) {
				system.emit('bank_set_key', req.params.page, req.params.bank, 'alignment', req.query.alignment.toLowerCase())
			}

			if (req.query.pngalignment && validateAlign(req.query.pngalignment)) {
				system.emit(
					'bank_set_key',
					req.params.page,
					req.params.bank,
					'pngalignment',
					req.query.pngalignment.toLowerCase()
				)
			}

			system.emit('graphics_bank_invalidate', req.params.page, req.params.bank)

			res.send(responseStatus)
		})

		if (electron && electron.app && electron.app.isPackaged) {
			// when packaged in electron, the webui is served from a path outside of the asar
			this.use(
				Express.static(path.join(process.resourcesPath, 'static'), {
					dotfiles: 'ignore',
					etag: true,
					extensions: ['htm', 'html'],
					index: 'index.html',
					maxAge: maxAge,
					redirect: false,
				})
			)

			this.get('*', function (req, res) {
				res.sendFile(path.join(process.resourcesPath, 'static/index.html'))
			})
		} else {
			// when headless or in dev, the webui is served from the source folder
			this.use(
				Express.static(path.join(__dirname, '/../../webui/build'), {
					dotfiles: 'ignore',
					etag: true,
					extensions: ['htm', 'html'],
					index: 'index.html',
					maxAge: maxAge,
					redirect: false,
				})
			)

			this.get('*', function (req, res) {
				res.sendFile(path.join(__dirname, '/../../webui/build/index.html'))
			})
		}
	}
}
