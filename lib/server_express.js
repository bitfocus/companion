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
const debug = require('debug')('lib/server_express')
const path = require('path')
const cors = require('cors')
const fs = require('fs')
const serveZip = require('express-serve-zip')

let electron
try {
	electron = require('electron')
} catch (_e) {
	// Doesnt matter
}

function createServeStatic(zipPath, folderPaths) {
	const maxAge = process.env.PRODUCTION ? 3600000 : 0

	if (fs.existsSync(zipPath)) {
		return serveZip(zipPath, {
			dotfiles: 'ignore',
			etag: true,
			extensions: ['html', 'md', 'json'],
			maxAge: maxAge,
			redirect: false,
		})
	} else {
		for (const folder of folderPaths) {
			if (fs.existsSync(folder)) {
				return Express.static(folder, {
					dotfiles: 'ignore',
					etag: true,
					extensions: ['html', 'md', 'json'],
					maxAge: maxAge,
					redirect: false,
				})
			}
		}

		// Failed to find a folder to use
		throw new Error('Failed to find static files to serve over http')
	}
}

class CompanionExpress extends Express {
	constructor(system) {
		super()

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

			debug('Got HTTP /press/bank/ (trigger) page ', req.params.page, 'button', req.params.bank)
			system.emit('bank_pressed', req.params.page, req.params.bank, true)

			setTimeout(function () {
				debug('Auto releasing HTTP /press/bank/ page ', req.params.page, 'button', req.params.bank)
				system.emit('bank_pressed', req.params.page, req.params.bank, false)
			}, 20)

			res.send('ok')
		})

		this.get('^/press/bank/:page([0-9]{1,2})/:bank([0-9]{1,2})/:direction(down|up)', function (req, res) {
			res.header('Access-Control-Allow-Origin', '*')
			res.header('Access-Control-Allow-Methods', 'GET,OPTIONS')
			res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Content-Length, X-Requested-With')

			if (req.params.direction == 'down') {
				debug('Got HTTP /press/bank/ (DOWN) page ', req.params.page, 'button', req.params.bank)
				system.emit('bank_pressed', req.params.page, req.params.bank, true)
			} else {
				debug('Got HTTP /press/bank/ (UP) page ', req.params.page, 'button', req.params.bank)
				system.emit('bank_pressed', req.params.page, req.params.bank, false)
			}

			res.send('ok')
		})

		this.get('^/rescan', function (req, res) {
			res.header('Access-Control-Allow-Origin', '*')
			res.header('Access-Control-Allow-Methods', 'GET,OPTIONS')
			res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Content-Length, X-Requested-With')

			debug('Got HTTP /rescan')
			system.emit('log', 'HTTP Server', 'debug', 'Rescanning USB')
			system.emit('devices_reenumerate')
			res.send('ok')
		})

		this.get('^/style/bank/:page([0-9]{1,2})/:bank([0-9]{1,2})', function (req, res) {
			res.header('Access-Control-Allow-Origin', '*')
			res.header('Access-Control-Allow-Methods', 'GET,OPTIONS')
			res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Content-Length, X-Requested-With')

			debug('Got HTTP /style/bank ', req.params.page, 'button', req.params.bank)

			let responseStatus = 'ok'

			function rgb(r, g, b) {
				r = parseInt(r, 16)
				g = parseInt(g, 16)
				b = parseInt(b, 16)

				if (isNaN(r) || isNaN(g) || isNaN(b)) return false
				return ((r & 0xff) << 16) | ((g & 0xff) << 8) | (b & 0xff)
			}

			function rgbRev(dec) {
				return {
					r: (dec & 0xff0000) >> 16,
					g: (dec & 0x00ff00) >> 8,
					b: dec & 0x0000ff,
				}
			}

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

		/**
		 * Electron doesn't handle serving files from inside the asar well. It unpacks them to a tmp dir, which can get cleaned up without it noticing
		 * We don't want to ship hundreds of loose files, so instead we can serve them from a zip file
		 */
		const resourcesDir =
			electron && electron.app && electron.app.isPackaged ? process.resourcesPath : path.join(__dirname, '/../')

		const webuiServer = createServeStatic(path.join(resourcesDir, 'webui.zip'), [
			path.join(resourcesDir, 'static'),
			path.join(resourcesDir, 'webui/build'),
		])
		const docsServer = createServeStatic(path.join(resourcesDir, 'docs.zip'), [path.join(resourcesDir, 'docs')])

		// Serve docs folder as static and public
		this.use('/docs', docsServer)

		// Serve the webui directory
		this.use(webuiServer)

		// Handle all unknown urls as accessing index.html
		this.get('*', function (req, res, next) {
			return webuiServer(
				{
					...req,
					url: '/index.html',
				},
				res,
				next
			)
		})
	}
}

exports = module.exports = function (system) {
	return new CompanionExpress(system)
}
