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

import fs from 'node:fs'
import path from 'node:path'
import compression from 'compression'
import cors from 'cors'
import Express from 'express'
// @ts-expect-error no types for this package
import serveZip from 'express-serve-zip'
import onHeaders from 'on-headers'
import { isPackaged } from '../Resources/Util.js'
import { isLoopbackHostAllowed } from './Handler.js'
import { createRewriteMiddleware, getCustomPrefixHeader } from './middleware/rewriteRootUrl.js'
import { makeIsTrustedProxyAddress, parseTrustedProxies } from './TRPC.js'

/**
 * Create a zip serve app
 */
function createServeStatic(
	zipPath: fs.PathLike,
	folderPaths: string[],
	redirectToSlashes?: boolean
): Express.RequestHandler {
	const maxAge = process.env.PRODUCTION ? 3600000 : 0

	if (fs.existsSync(zipPath)) {
		return serveZip(zipPath, {
			dotfiles: 'ignore',
			etag: true,
			extensions: ['html', 'md', 'json'],
			maxAge: maxAge,
			redirect: redirectToSlashes ?? false,
			prefix: (req: Express.Request) => getCustomPrefixHeader(req),
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

/**
 * Create a middleware that fixes up the Cache-Control header of static responses just before
 * headers are sent, based on the final Content-Type/path:
 * - HTML must always be revalidated (cheap 304s via the existing ETags). Safari and iOS
 *   home-screen web apps otherwise cache index.html beyond its 1 hour maxAge, leaving it
 *   referencing content-hashed chunks deleted by a Companion upgrade (broken/blank page
 *   until the cache is manually cleared).
 * - Content-hashed build assets (vite output under assets/) never change, so are safe to
 *   cache forever.
 * - Everything else keeps the maxAge computed by the static server.
 */
function createCacheControlMiddleware(): Express.RequestHandler {
	return (req, res, next) => {
		onHeaders(res, () => {
			const contentType = String(res.getHeader('content-type') || '').toLowerCase()
			if (contentType.includes('text/html')) {
				// no-cache (not no-store) keeps 304 revalidation working
				res.setHeader('Cache-Control', 'no-cache')
			} else if (req.path.startsWith('/assets/')) {
				// Vite content-hashed filenames - safe to cache forever
				res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
			}
		})
		next()
	}
}

export class UIExpress {
	readonly app = Express()
	#apiRouter = Express.Router()
	#legacyApiRouter = Express.Router()
	#connectionApiRouter = Express.Router()

	constructor(internalApiRouter: Express.Router, trustedProxies: string | undefined, metricsRouter: Express.Router) {
		// Configure how the client ip is determined when running behind a reverse proxy.
		// Without this, a proxied request appears to originate from the proxy (often loopback),
		// which would make remote clients look local to features that trust loopback.
		// Accepts comma or semicolon separated lists of addresses/subnets, or special values like 'loopback'.
		const trustedProxyParts = parseTrustedProxies(trustedProxies)
		if (trustedProxyParts.length > 0) {
			this.app.set('trust proxy', trustedProxyParts.length > 1 ? trustedProxyParts : trustedProxyParts[0])
		}

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

		// The /int api is internal-only and not CORS-accessible. Guard it against DNS rebinding against
		// localhost: reject loopback connections whose Host names a non-loopback domain (the rebinding
		// signature).
		const isTrustedProxyAddress = makeIsTrustedProxyAddress(trustedProxies)
		this.app.use(
			'/int',
			(req, res, next) => {
				const isTrustedProxy = isTrustedProxyAddress(req.socket.remoteAddress)
				if (!isLoopbackHostAllowed(req.socket.remoteAddress, req.headers.host, { isTrustedProxy })) {
					res.status(403).send('Forbidden')
					return
				}
				next()
			},
			internalApiRouter,
			(_req, res) => {
				res.status(404)
				res.send('Not found')
			}
		)

		// Use the router #connectionApiRouter to add API routes dynamically, this router can be redefined at runtime with setter
		// CORS is enabled here as this is part of the intentionally cross-origin accessible HTTP api.
		this.app.use('/instance', cors(), async (r, s, n) => this.#connectionApiRouter(r, s, n))

		// Redirect /connections/instance to /instance.
		// This is to maintain compatibility with modules which used relative links from the edit panel, as the path of those changed in 4.1
		this.app.use('/connections/instance', async (req, res) => {
			res.redirect(301, `/instance${req.url}`)
		})

		// Prometheus metrics endpoint. Mounted before /api (more specific path wins) and intentionally
		// without CORS - it is scraped server-side by Prometheus, not from a browser. The router itself
		// enforces the enable toggle and bearer-token auth.
		this.app.use('/api/metrics', metricsRouter)

		// Use the router #apiRouter to add API routes dynamically, this router can be redefined at runtime with setter
		// CORS is enabled here as this is part of the intentionally cross-origin accessible HTTP api.
		this.app.use('/api', cors(), async (r, s, n) => this.#apiRouter(r, s, n))

		// Use the router #legacyApiRouter to add API routes dynamically, this router can be redefined at runtime with setter
		this.app.use(async (r, s, n) => this.#legacyApiRouter(r, s, n))

		function getResourcePath(subpath: string): string {
			if (!isPackaged()) {
				subpath = path.join('../../..', subpath)
			}
			return path.join(import.meta.dirname, subpath)
		}

		/**
		 * We don't want to ship hundreds of loose files, so instead we can serve the webui files from a zip file
		 */
		const webuiServer = createServeStatic(getResourcePath('webui.zip'), [
			getResourcePath('static'),
			getResourcePath('webui/build'),
		])
		const docsServer = createServeStatic(getResourcePath('docs.zip'), [getResourcePath('docs/placeholder')], true)

		// Create rewrite middleware to replace ROOT_URL_HERE in HTML/CSS/JS files
		const rewriteMiddleware = createRewriteMiddleware()

		// Create middleware to fix up the Cache-Control header of static responses
		const cacheControlMiddleware = createCacheControlMiddleware()

		// Serve user-guide folder as static and public
		this.app.use('/user-guide', compression(), cacheControlMiddleware, rewriteMiddleware, docsServer)
		this.app.get('/user-guide', (req, res) => {
			// Redirect to add trailing slash
			res.redirect(301, path.join(getCustomPrefixHeader(req), '/user-guide/'))
		})

		// Serve the webui directory
		this.app.use(compression(), cacheControlMiddleware, rewriteMiddleware, webuiServer)

		// Handle all unknown urls as accessing index.html
		this.app.get('*all', compression(), cacheControlMiddleware, rewriteMiddleware, async (req, res, next) => {
			if (req.url.startsWith('/user-guide/')) {
				req.url = '/404.html'
				res.status(404)
				return docsServer(req, res, next)
			} else {
				req.url = '/index.html'
				return webuiServer(req, res, next)
			}
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
