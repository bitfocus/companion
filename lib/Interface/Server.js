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

var debug = require('debug')('Interface/Server')
var Express = require('express')
var { Server } = require('http')
var path = require('path')
var electron = require('electron')

var maxAge = process.env.PRODUCTION ? 3600000 : 0

class CompanionExpress extends Express {
	constructor() {
		super()

		this.use(function (req, res, next) {
			res.set('X-App', 'Bitfocus AS')
			next()
		})

		if (electron.app && electron.app.isPackaged) {
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
			this.use(
				Express.static(path.join(__dirname, '/../webui/build'), {
					dotfiles: 'ignore',
					etag: true,
					extensions: ['htm', 'html'],
					index: 'index.html',
					maxAge: maxAge,
					redirect: false,
				})
			)

			this.get('*', function (req, res) {
				res.sendFile(path.join(__dirname, '/../webui/build/index.html'))
			})
		}
	}
}

class InterfaceServer extends Server {
	constructor(registry, express = new CompanionExpress()) {
		super(express)

		this.registry = registry
		this.system = this.registry.system
		this.express = express

		this.config = this.registry.config.getAll()
		this.listenForHttp()

		this.express.use('/int', (req, res, next) => {
			var handled = false

			var timeout = setTimeout(() => {
				handled = true
				next()
			}, 2000)

			var match

			// Return any asset made to /int/documentation/
			if ((match = req.url.match(/^\/documentation\/(.+?)(\?.+)?$/))) {
				var path = this.registry.appRoot + '/documentation'
				var file = match[1].replace(/\.\.+/g, '')

				if (file.match(/\.(jpe?g|gif|png|pdf)$/) && fs.existsSync(path + '/' + file)) {
					if (done !== undefined && typeof done == 'function') {
						done()
					}

					res.sendFile(path + '/' + file)
				}
			} else if ((match = req.url.match(/^\/help\/([^/]+)\/(.+?)(\?.+)?$/))) {
				var path = this.registry.appRoot + '/node_modules/companion-module-'
				var module = match[1].replace(/\.\.+/g, '')
				var file = match[2].replace(/\.\.+/g, '')

				if (file.match(/\.(jpe?g|gif|png|pdf)$/) && fs.existsSync(path + '/' + module + '/' + file)) {
					done()
					res.sendFile(path + '/' + module + '/' + file)
				}
			} else {
				this.system.emit('http_req', req, res, () => {
					if (!handled) {
						clearTimeout(timeout)
						handled = true
					}
				})
			}
		})

		this.system.on('io_connect', (client) => {
			client.on('get_help_md', this.getDocumentationMarkdown.bind(this))
		})

		this.express.options('/press/bank/*', (req, res, next) => {
			res.header('Access-Control-Allow-Origin', '*')
			res.header('Access-Control-Allow-Methods', 'GET,OPTIONS')
			res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Content-Length, X-Requested-With')
			res.send(200)
		})

		this.express.get('^/press/bank/:page([0-9]{1,2})/:bank([0-9]{1,2})', this.processBankPress.bind(this))

		this.express.get(
			'^/press/bank/:page([0-9]{1,2})/:bank([0-9]{1,2})/:direction(down|up)',
			this.processBankTrigger.bind(this)
		)

		this.express.get('^/style/bank/:page([0-9]{1,2})/:bank([0-9]{1,2})', this.processBankStyle.bind(this))
	}

	getDocumentationMarkdown(req, answer) {
		// Return the rendered HTML for the requested Markdown file.
		// req will look like { file:'file.md' }.

		// Pass the filename requested back to the response so the receiver can watch for
		//  their response in case two different requests were made at the same time.
		let resp = {
			error: true,
			file: req.file,
			markdown: '',
		}

		if (req.file !== undefined) {
			// Prevent directory traversal
			const markdownFilename = req.file.replace(/(\.\.|\/)/g, '')
			const path = require('app-root-path') + '/documentation/' + markdownFilename

			if (fs.existsSync(path)) {
				try {
					resp.markdown = fs.readFileSync(path).toString()
					resp.baseUrl = '/int/documentation/'
					resp.error = false
				} catch (e) {
					debug('Error loading help ' + path)
					debug(e)
				}
			}
		} else {
			debug('Invalid get_help request')
		}

		answer(resp)
	}

	listenForHttp() {
		if (this.close !== undefined) {
			this.close()
		}

		try {
			this.on('error', (e) => {
				if (e.code == 'EADDRNOTAVAIL') {
					debug('EADDRNOTAVAIL: ' + this.config.bind_ip)
					this.registry.emit('skeleton-info', 'appURL', this.config.bind_ip + ' unavailable. Select another IP')
					this.registry.emit('skeleton-info', 'appStatus', 'Error')
				} else {
					debug(e)
				}
			}).listen(this.config.http_port, this.config.bind_ip, () => {
				debug('new url:', 'http://' + this.address().address + ':' + this.address().port + '/')
				this.registry.emit('skeleton-info', 'appStatus', 'Running')
				this.registry.emit(
					'skeleton-info',
					'appURL',
					'http://' + this.address().address + ':' + this.address().port + '/'
				)
			})
		} catch (e) {
			debug('http bind error', e)
		}
		//TODO: call Intstance/Internal.getBoundIp()
	}

	log() {
		var args = Array.prototype.slice.call(arguments)
		args.unshift('log', 'http')
		debug(args)
	}

	processBankPress(req, res) {
		res.header('Access-Control-Allow-Origin', '*')
		res.header('Access-Control-Allow-Methods', 'GET,OPTIONS')
		res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Content-Length, X-Requested-With')

		debug('Got HTTP /press/bank/ (trigger) page ', req.params.page, 'button', req.params.bank)
		this.system.emit('bank_pressed', req.params.page, req.params.bank, true)

		setTimeout(() => {
			debug('Auto releasing HTTP /press/bank/ page ', req.params.page, 'button', req.params.bank)
			this.system.emit('bank_pressed', req.params.page, req.params.bank, false)
		}, 20)

		res.send('ok')
	}

	processBankStyle(req, res) {
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

		function validateAlign(data) {
			data = data.toLowerCase().split(':')
			const hValues = ['left', 'center', 'right']
			const vValues = ['top', 'center', 'bottom']
			return hValues.includes(data[0]) && vValues.includes(data[1])
		}

		if (req.query.bgcolor) {
			const value = req.query.bgcolor.replace(/#/, '')
			const color = rgb(value.substr(0, 2), value.substr(2, 2), value.substr(4, 2))
			if (color !== false) {
				this.system.emit('bank_set_key', req.params.page, req.params.bank, 'bgcolor', color)
			}
		}

		if (req.query.color) {
			const value = req.query.color.replace(/#/, '')
			const color = rgb(value.substr(0, 2), value.substr(2, 2), value.substr(4, 2))
			if (color !== false) {
				this.system.emit('bank_set_key', req.params.page, req.params.bank, 'color', color)
			}
		}

		if (req.query.size) {
			const value = req.query.size.replace(/pt/i, '')
			this.system.emit('bank_set_key', req.params.page, req.params.bank, 'size', value)
		}

		if (req.query.text || req.query.text === '') {
			this.system.emit('bank_set_key', req.params.page, req.params.bank, 'text', req.query.text)
		}

		if (req.query.png64 || req.query.png64 === '') {
			if (req.query.png64 === '') {
				this.system.emit('bank_set_key', req.params.page, req.params.bank, 'png64', undefined)
			} else if (!req.query.png64.match(/data:.*?image\/png/)) {
				responseStatus = 'png64 must be a base64 encoded png file'
			} else {
				const data = req.query.png64.replace(/^.*base64,/, '')
				this.system.emit('bank_set_key', req.params.page, req.params.bank, 'png64', data)
			}
		}

		if (req.query.alignment && validateAlign(req.query.alignment)) {
			this.system.emit('bank_set_key', req.params.page, req.params.bank, 'alignment', req.query.alignment.toLowerCase())
		}

		if (req.query.pngalignment && validateAlign(req.query.pngalignment)) {
			this.system.emit(
				'bank_set_key',
				req.params.page,
				req.params.bank,
				'pngalignment',
				req.query.pngalignment.toLowerCase()
			)
		}

		this.registry.graphics.invalidateBank(req.params.page, req.params.bank)

		res.send(responseStatus)
	}

	processBankTrigger(req, res) {
		res.header('Access-Control-Allow-Origin', '*')
		res.header('Access-Control-Allow-Methods', 'GET,OPTIONS')
		res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Content-Length, X-Requested-With')

		if (req.params.direction == 'down') {
			debug('Got HTTP /press/bank/ (DOWN) page ', req.params.page, 'button', req.params.bank)
			this.system.emit('bank_pressed', req.params.page, req.params.bank, true)
		} else {
			debug('Got HTTP /press/bank/ (UP) page ', req.params.page, 'button', req.params.bank)
			this.system.emit('bank_pressed', req.params.page, req.params.bank, false)
		}

		res.send('ok')
	}
}

exports = module.exports = InterfaceServer
