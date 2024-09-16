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
import { fileURLToPath } from 'url'
import bodyParser from 'body-parser'
import type { Registry } from '../Registry.js'

/**
 * Create a zip serve app
 */
function createServeStatic(zipPath: fs.PathLike, folderPaths: string[]): Express.RequestHandler {
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

export class UIExpress {
	// readonly #logger = LogController.createLogger('UI/Express')

	readonly app = Express()
	#apiRouter = Express.Router()
	#legacyApiRouter = Express.Router()

	constructor(registry: Registry) {
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

		this.app.use('/int', registry.api_router, (_req, res) => {
			res.status(404)
			res.send('Not found')
		})

		this.app.use('/instance/:label', (req, res, _next) => {
			const label = req.params.label
			const connectionId = registry.instance.getIdForLabel(label) || label
			const instance = registry.instance.moduleHost.getChild(connectionId)
			if (instance) {
				instance.executeHttpRequest(req, res)
			} else {
				res.status(404).send(JSON.stringify({ status: 404, message: 'Not Found' }))
			}
		})

		// Use the router #apiRouter to add API routes dynamically, this router can be redefined at runtime with setter
		this.app.use('/api', (r, s, n) => this.#apiRouter(r, s, n))

		// Use the router #legacyApiRouter to add API routes dynamically, this router can be redefined at runtime with setter
		this.app.use((r, s, n) => this.#legacyApiRouter(r, s, n))

		function getResourcePath(subpath: string): string {
			if (isPackaged()) {
				return path.join(__dirname, subpath)
			} else {
				return fileURLToPath(new URL(path.join('../../..', subpath), import.meta.url))
			}
		}

		/**
		 * We don't want to ship hundreds of loose files, so instead we can serve the webui files from a zip file
		 */

		const webuiServer = createServeStatic(getResourcePath('webui.zip'), [
			getResourcePath('static'),
			getResourcePath('webui/build'),
		])
		const docsServer = createServeStatic(getResourcePath('docs.zip'), [getResourcePath('docs')])

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

	/**
	 * Set a new router as the ApiRouter
	 */
	set apiRouter(router: Express.Router) {
		this.#apiRouter = router
	}

	/**
	 * Set a new router as the legacyApiRouter
	 */
	set legacyApiRouter(router: Express.Router) {
		this.#legacyApiRouter = router
	}
}
