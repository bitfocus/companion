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

import Express from 'express'
import path from 'path'
import { isPackaged, rgb } from '../Resources/Util.js'
import cors from 'cors'
import fs from 'fs'
import serveZip from 'express-serve-zip'
import createDebug from 'debug'
import { fileURLToPath } from 'url'

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

class UIExpress extends Express {
	debug = createDebug('lib/UI/Express')

	constructor(registry) {
		super()

		this.registry = registry

		this.use(cors())

		this.use((req, res, next) => {
			res.set('X-App', 'Bitfocus AS')
			next()
		})

		this.use('/int', this.registry.api_router, (req, res) => {
			res.status(404)
			res.send('Not found')
		})

		this.options('/press/bank/*', (req, res, next) => {
			res.header('Access-Control-Allow-Origin', '*')
			res.header('Access-Control-Allow-Methods', 'GET,OPTIONS')
			res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Content-Length, X-Requested-With')
			res.send(200)
		})

		this.get('^/press/bank/:page([0-9]{1,2})/:bank([0-9]{1,2})', (req, res) => {
			res.header('Access-Control-Allow-Origin', '*')
			res.header('Access-Control-Allow-Methods', 'GET,OPTIONS')
			res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Content-Length, X-Requested-With')

			this.debug('Got HTTP /press/bank/ (trigger) page ', req.params.page, 'button', req.params.bank)
			this.bank.action.pressBank(req.params.page, req.params.bank, true)

			setTimeout(() => {
				this.debug('Auto releasing HTTP /press/bank/ page ', req.params.page, 'button', req.params.bank)
				this.bank.action.pressBank(req.params.page, req.params.bank, false)
			}, 20)

			res.send('ok')
		})

		this.get('^/press/bank/:page([0-9]{1,2})/:bank([0-9]{1,2})/:direction(down|up)', (req, res) => {
			res.header('Access-Control-Allow-Origin', '*')
			res.header('Access-Control-Allow-Methods', 'GET,OPTIONS')
			res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Content-Length, X-Requested-With')

			if (req.params.direction == 'down') {
				this.debug('Got HTTP /press/bank/ (DOWN) page ', req.params.page, 'button', req.params.bank)
				this.bank.action.pressBank(req.params.page, req.params.bank, true)
			} else {
				this.debug('Got HTTP /press/bank/ (UP) page ', req.params.page, 'button', req.params.bank)
				this.bank.action.pressBank(req.params.page, req.params.bank, false)
			}

			res.send('ok')
		})

		this.get('^/rescan', (req, res) => {
			res.header('Access-Control-Allow-Origin', '*')
			res.header('Access-Control-Allow-Methods', 'GET,OPTIONS')
			res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Content-Length, X-Requested-With')

			this.debug('Got HTTP /rescan')
			this.registry.log.add('http', 'debug', 'Rescanning USB')
			this.registry.surfaces.refreshDevices().then(
				() => {
					res.send('ok')
				},
				() => {
					res.send('fail')
				}
			)
		})

		this.get('^/style/bank/:page([0-9]{1,2})/:bank([0-9]{1,2})', (req, res) => {
			res.header('Access-Control-Allow-Origin', '*')
			res.header('Access-Control-Allow-Methods', 'GET,OPTIONS')
			res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Content-Length, X-Requested-With')

			this.debug('Got HTTP /style/bank ', req.params.page, 'button', req.params.bank)

			let responseStatus = 'ok'

			const validateAlign = (data) => {
				data = data.toLowerCase().split(':')
				const hValues = ['left', 'center', 'right']
				const vValues = ['top', 'center', 'bottom']
				return hValues.includes(data[0]) && vValues.includes(data[1])
			}

			if (req.query.bgcolor) {
				const value = req.query.bgcolor.replace(/#/, '')
				const color = rgb(value.substr(0, 2), value.substr(2, 2), value.substr(4, 2), 16)
				if (color !== false) {
					this.bank.changeField(req.params.page, req.params.bank, 'bgcolor', color, false)
				}
			}

			if (req.query.color) {
				const value = req.query.color.replace(/#/, '')
				const color = rgb(value.substr(0, 2), value.substr(2, 2), value.substr(4, 2), 16)
				if (color !== false) {
					this.bank.changeField(req.params.page, req.params.bank, 'color', color, false)
				}
			}

			if (req.query.size) {
				const value = req.query.size.replace(/pt/i, '')
				this.bank.changeField(req.params.page, req.params.bank, 'size', value, false)
			}

			if (req.query.text || req.query.text === '') {
				this.bank.changeField(req.params.page, req.params.bank, 'text', req.query.text, false)
			}

			if (req.query.png64 || req.query.png64 === '') {
				if (req.query.png64 === '') {
					this.bank.changeField(req.params.page, req.params.bank, 'png64', undefined, false)
				} else if (!req.query.png64.match(/data:.*?image\/png/)) {
					responseStatus = 'png64 must be a base64 encoded png file'
				} else {
					const data = req.query.png64.replace(/^.*base64,/, '')
					this.bank.changeField(req.params.page, req.params.bank, 'png64', data, false)
				}
			}

			if (req.query.alignment && validateAlign(req.query.alignment)) {
				this.bank.changeField(req.params.page, req.params.bank, 'alignment', req.query.alignment.toLowerCase(), false)
			}

			if (req.query.pngalignment && validateAlign(req.query.pngalignment)) {
				this.bank.changeField(
					req.params.page,
					req.params.bank,
					'pngalignment',
					req.query.pngalignment.toLowerCase(),
					false
				)
			}

			this.graphics.invalidateBank(req.params.page, req.params.bank)

			res.send(responseStatus)
		})

		/**
		 * Electron doesn't handle serving files from inside the asar well. It unpacks them to a tmp dir, which can get cleaned up without it noticing
		 * We don't want to ship hundreds of loose files, so instead we can serve them from a zip file
		 */
		const resourcesDir = isPackaged() ? __dirname : fileURLToPath(new URL('../../', import.meta.url))

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
		this.get('*', (req, res, next) => {
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

	get bank() {
		if (this.registry) {
			return this.registry.bank
		} else {
			return null
		}
	}
}

export default UIExpress
