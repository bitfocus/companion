/*
 * This file is part of the Companion project
 * Copyright (c) 2018 Bitfocus AS
 * Authors: William Viker <william@bitfocus.io>, Håkon Nessjøen <haakon@bitfocus.io>
 *
 * This program is free software.
 * You should have received a copy of the MIT licence as well as the Bitfocus
 * Individual Contributor License Agreement for companion along with
 * this program.
 */

import Express from 'express'
import path from 'path'
import { isPackaged } from '../Resources/Util.js'
import cors from 'cors'
import fs from 'fs'
// @ts-ignore
import serveZip from 'express-serve-zip'
import { fileURLToPath } from 'url'
import * as trpcExpress from '@trpc/server/adapters/express'
import { AppRouter, createTrpcContext } from './TRPC.js'

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
	#connectionApiRouter = Express.Router()
	#trpcRouter = Express.Router()

	constructor(internalApiRouter: Express.Router) {
		this.app.use(cors())

		this.app.use((_req, res, next) => {
			res.set('X-App', 'Bitfocus Companion')
			next()
		})

		// parse application/json
		this.app.use(Express.json({ strict: false }))

		// parse application/x-www-form-urlencoded
		this.app.use(Express.urlencoded({ extended: false }))

		// parse text/plain
		this.app.use(Express.text())

		this.app.use('/int', internalApiRouter, (_req, res) => {
			res.status(404)
			res.send('Not found')
		})

		// Use the router #connectionApiRouter to add API routes dynamically, this router can be redefined at runtime with setter
		this.app.use('/instance', (r, s, n) => this.#connectionApiRouter(r, s, n))

		// Use the router #apiRouter to add API routes dynamically, this router can be redefined at runtime with setter
		this.app.use('/api', (r, s, n) => this.#apiRouter(r, s, n))

		// Use the router #apiRouter to add API routes dynamically, this router can be redefined at runtime with setter
		this.app.use('/trpc', (r, s, n) => this.#trpcRouter(r, s, n))

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
		this.app.get('*all', (req, res, next) => {
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

	/**
	 * Set a new router as the connectionApiRouter
	 */
	set connectionApiRouter(router: Express.Router) {
		this.#connectionApiRouter = router
	}

	#boundTrpcRouter = false
	bindTrpcRouter(trpcRouter: AppRouter) {
		if (this.#boundTrpcRouter) throw new Error('tRPC router already bound')
		this.#boundTrpcRouter = true

		this.#trpcRouter.use(
			trpcExpress.createExpressMiddleware({
				router: trpcRouter,
				createContext: createTrpcContext,
			})
		)
	}
}
