//
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
import { isPackaged, ParseAlignment, rgb } from '../Resources/Util.js'
import cors from 'cors'
import fs from 'fs'
// @ts-ignore
import serveZip from 'express-serve-zip'
import LogController from '../Log/Controller.js'
import { fileURLToPath } from 'url'
import bodyParser from 'body-parser'

/**
 * Create a zip serve app
 * @param {fs.PathLike} zipPath
 * @param {string[]} folderPaths
 */
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

class UIExpress {
	logger = LogController.createLogger('UI/Express')

	app = Express()

	/**
	 * @param {import('../Registry.js').default} registry
	 */
	constructor(registry) {
		this.registry = registry

		this.app.use(cors())

		this.app.use((_req, res, next) => {
			res.set('X-App', 'Bitfocus Companion')
			next()
		})

		// parse application/x-www-form-urlencoded
		this.app.use(bodyParser.urlencoded({ extended: false }))

		// parse application/json
		this.app.use(bodyParser.json())

		// parse text/plain
		this.app.use(bodyParser.text())

		this.app.use('/int', this.registry.api_router, (_req, res) => {
			res.status(404)
			res.send('Not found')
		})

		this.app.use('/instance/:label', (req, res, _next) => {
			const label = req.params.label
			const connectionId = this.registry.instance.getIdForLabel(label) || label
			const instance = this.registry.instance.moduleHost.getChild(connectionId)
			if (instance) {
				instance.executeHttpRequest(req, res)
			} else {
				res.status(404).send(JSON.stringify({ status: 404, message: 'Not Found' }))
			}
		})

		this.app.options('/press/bank/*', (_req, res, _next) => {
			res.header('Access-Control-Allow-Origin', '*')
			res.header('Access-Control-Allow-Methods', 'GET,OPTIONS')
			res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Content-Length, X-Requested-With')
			res.send(200)
		})

		this.app.get('^/press/bank/:page([0-9]{1,2})/:bank([0-9]{1,2})', (req, res) => {
			res.header('Access-Control-Allow-Origin', '*')
			res.header('Access-Control-Allow-Methods', 'GET,OPTIONS')
			res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Content-Length, X-Requested-With')

			this.logger.info(`Got HTTP /press/bank/ (trigger) page ${req.params.page} button ${req.params.bank}`)

			const controlId = this.registry.page.getControlIdAtOldBankIndex(Number(req.params.page), Number(req.params.bank))
			if (!controlId) {
				res.status(404)
				res.send('No control at location')
				return
			}

			this.registry.controls.pressControl(controlId, true, undefined)

			setTimeout(() => {
				this.logger.info(`Auto releasing HTTP /press/bank/ page ${req.params.page} button ${req.params.bank}`)
				this.registry.controls.pressControl(controlId, false, undefined)
			}, 20)

			res.send('ok')
		})

		this.app.get('^/press/bank/:page([0-9]{1,2})/:bank([0-9]{1,2})/:direction(down|up)', (req, res) => {
			res.header('Access-Control-Allow-Origin', '*')
			res.header('Access-Control-Allow-Methods', 'GET,OPTIONS')
			res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Content-Length, X-Requested-With')

			if (req.params.direction == 'down') {
				this.logger.info(`Got HTTP /press/bank/ (DOWN) page ${req.params.page} button ${req.params.bank}`)

				const controlId = this.registry.page.getControlIdAtOldBankIndex(
					Number(req.params.page),
					Number(req.params.bank)
				)
				if (!controlId) {
					res.status(404)
					res.send('No control at location')
					return
				}

				this.registry.controls.pressControl(controlId, true, undefined)
			} else {
				this.logger.info(`Got HTTP /press/bank/ (UP) page ${req.params.page} button ${req.params.bank}`)

				const controlId = this.registry.page.getControlIdAtOldBankIndex(
					Number(req.params.page),
					Number(req.params.bank)
				)
				if (!controlId) {
					res.status(404)
					res.send('No control at location')
					return
				}

				this.registry.controls.pressControl(controlId, false, undefined)
			}

			res.send('ok')
		})

		this.app.get('^/rescan', (_req, res) => {
			res.header('Access-Control-Allow-Origin', '*')
			res.header('Access-Control-Allow-Methods', 'GET,OPTIONS')
			res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Content-Length, X-Requested-With')

			this.logger.info('Got HTTP /rescan')
			this.registry.surfaces.triggerRefreshDevices().then(
				() => {
					res.send('ok')
				},
				() => {
					res.send('fail')
				}
			)
		})

		this.app.get('^/style/bank/:page([0-9]{1,2})/:bank([0-9]{1,2})', (req, res) => {
			res.header('Access-Control-Allow-Origin', '*')
			res.header('Access-Control-Allow-Methods', 'GET,OPTIONS')
			res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Content-Length, X-Requested-With')

			this.logger.info(`Got HTTP /style/bank ${req.params.page} button ${req.params.bank}`)

			const controlId = this.registry.page.getControlIdAtOldBankIndex(Number(req.params.page), Number(req.params.bank))
			if (!controlId) {
				res.status(404)
				res.send('No control at location')
				return
			}

			const control = this.registry.controls.getControl(controlId)

			if (!control || !control.supportsStyle) {
				res.status(404)
				res.send('Not found')
				return
			}

			const newFields = {}

			if (req.query.bgcolor) {
				const value = req.query.bgcolor.replace(/#/, '')
				const color = rgb(value.substr(0, 2), value.substr(2, 2), value.substr(4, 2), 16)
				if (color !== false) {
					newFields.bgcolor = color
				}
			}

			if (req.query.color) {
				const value = req.query.color.replace(/#/, '')
				const color = rgb(value.substr(0, 2), value.substr(2, 2), value.substr(4, 2), 16)
				if (color !== false) {
					newFields.color = color
				}
			}

			if (req.query.size) {
				const value = req.query.size.replace(/pt/i, '')
				newFields.size = value
			}

			if (req.query.text || req.query.text === '') {
				newFields.text = req.query.text
			}

			if (req.query.png64 || req.query.png64 === '') {
				if (req.query.png64 === '') {
					newFields.png64 = null
				} else if (!req.query.png64.match(/data:.*?image\/png/)) {
					res.status(400)
					res.send('png64 must be a base64 encoded png file')
					return
				} else {
					const data = req.query.png64.replace(/^.*base64,/, '')
					newFields.png64 = data
				}
			}

			if (req.query.alignment) {
				try {
					const [, , alignment] = ParseAlignment(req.query.alignment)
					newFields.alignment = alignment
				} catch (e) {
					// Ignore
				}
			}

			if (req.query.pngalignment) {
				try {
					const [, , alignment] = ParseAlignment(req.query.pngalignment)
					newFields.pngalignment = alignment
				} catch (e) {
					// Ignore
				}
			}

			if (Object.keys(newFields).length > 0) {
				control.styleSetFields(newFields)
			}

			res.send('ok')
		})

		this.app.get('^/set/custom-variable/:name', (req, res) => {
			res.header('Access-Control-Allow-Origin', '*')
			res.header('Access-Control-Allow-Methods', 'GET,OPTIONS')
			res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Content-Length, X-Requested-With')

			this.logger.debug(`Got HTTP /set/custom-variable/ name ${req.params.name} to value ${req.query.value}`)
			const result = this.registry.instance.variable.custom.setValue(req.params.name, req.query.value)
			if (result) {
				res.send(result)
			} else {
				res.send('ok')
			}
		})

		/**
		 * We don't want to ship hundreds of loose files, so instead we can serve the webui files from a zip file
		 */
		const resourcesDir = isPackaged() ? __dirname : fileURLToPath(new URL('../../', import.meta.url))

		const webuiServer = createServeStatic(path.join(resourcesDir, 'webui.zip'), [
			path.join(resourcesDir, 'static'),
			path.join(resourcesDir, 'webui/build'),
		])
		const docsServer = createServeStatic(path.join(resourcesDir, 'docs.zip'), [path.join(resourcesDir, 'docs')])

		// Serve docs folder as static and public
		this.app.use('/docs', docsServer)

		// Serve the webui directory
		this.app.use(webuiServer)

		// Handle all unknown urls as accessing index.html
		this.app.get('*', (req, res, next) => {
			req.url = '/index.html'
			return webuiServer(req, res, next)
		})
	}
}

export default UIExpress
