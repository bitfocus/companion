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
import { isPackaged } from '../Resources/Util.js'
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

		this.legacyApiRouter = Express.Router()

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

		this.app.use(this.legacyApiRouter)

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
