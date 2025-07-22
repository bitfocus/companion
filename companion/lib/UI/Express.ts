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
// @ts-expect-error no types for this package
import serveZip from 'express-serve-zip'
import { fileURLToPath } from 'url'
import compression from 'compression'

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

	constructor(internalApiRouter: Express.Router) {
		this.app.use(cors())

		// this.app.set('trust proxy', 'loopback') // TODO - set this from an env variable

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
		this.app.use('/instance', async (r, s, n) => this.#connectionApiRouter(r, s, n))

		// Redirect /connections/instance to /instance.
		// This is to maintain compatibility with modules which used relative links from the edit panel, as the path of those changed in 4.1
		this.app.use('/connections/instance', async (req, res) => {
			res.redirect(301, `/instance${req.url}`)
		})

		// Use the router #apiRouter to add API routes dynamically, this router can be redefined at runtime with setter
		this.app.use('/api', async (r, s, n) => this.#apiRouter(r, s, n))

		// Use the router #legacyApiRouter to add API routes dynamically, this router can be redefined at runtime with setter
		this.app.use(async (r, s, n) => this.#legacyApiRouter(r, s, n))

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
		const webuiServerWithRewriter: Express.RequestHandler = async (req, res, next) => {
			// This is pretty horrible, but we need to rewrite the ROOT_URL_HERE in the html/js/css files to the correct prefix
			// First ignore a few file types that we don't want to rewrite
			if (
				!req.url.endsWith('.png') &&
				!req.url.endsWith('.woff') &&
				!req.url.endsWith('.woff2') &&
				!req.url.endsWith('.svg') &&
				!req.url.endsWith('.map')
			) {
				let customPrefixFromHeader = req.headers['companion-custom-prefix']
				if (customPrefixFromHeader?.includes('://') || customPrefixFromHeader?.includes('..'))
					customPrefixFromHeader = undefined // Don't allow custom prefixes that are not just a path

				// Force the inner response to be uncompressed, as we need to be able to modify the response body
				const originalAcceptEncoding = req.headers['accept-encoding']
				req.headers['accept-encoding'] = 'identity'

				// If there is a prefix in the header, use that to customise the html response
				let processedPrefix = customPrefixFromHeader ? `/${customPrefixFromHeader}` : '/'
				if (processedPrefix.endsWith('/')) processedPrefix = processedPrefix.slice(0, -1)

				// Store original methods
				const originalEnd = res.end.bind(res)
				let responseBody = ''
				let hasEnded = false

				// Override res.write to capture response data without writing it yet
				res.write = function (
					chunk: any,
					encoding?: BufferEncoding | ((error: Error | null | undefined) => void),
					cb?: (error: Error | null | undefined) => void
				): boolean {
					if (hasEnded) return false

					if (chunk) {
						if (Buffer.isBuffer(chunk)) {
							responseBody += chunk.toString()
						} else if (typeof chunk === 'string') {
							responseBody += chunk
						}
					}

					// Call the callback if provided to maintain flow control
					if (typeof encoding === 'function') {
						setImmediate(() => encoding(null))
					} else if (cb) {
						setImmediate(() => cb(null))
					}

					return true
				}

				// Override res.end to modify the final response
				res.end = function (chunk?: any, encoding?: BufferEncoding | (() => void), cb?: () => void) {
					if (hasEnded) return res
					hasEnded = true

					if (chunk) {
						if (Buffer.isBuffer(chunk)) {
							responseBody += chunk.toString()
						} else if (typeof chunk === 'string') {
							responseBody += chunk
						}
					}

					// Replace ROOT_URL_HERE with the processed prefix
					const modifiedBody = responseBody.replace(/\/ROOT_URL_HERE/g, processedPrefix)

					// Remove any existing content-length header since we're changing the content
					res.removeHeader('content-length')

					req.headers['accept-encoding'] = originalAcceptEncoding

					return originalEnd(modifiedBody, encoding as any, cb)
				}
			}

			return webuiServer(req, res, next)
		}

		// Serve docs folder as static and public
		this.app.use('/docs', docsServer)

		// Serve the webui directory
		this.app.use(compression(), webuiServerWithRewriter)

		// Handle all unknown urls as accessing index.html
		this.app.get('*all', async (req, res, next) => {
			req.url = '/index.html'
			return webuiServerWithRewriter(req, res, next)
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
}
