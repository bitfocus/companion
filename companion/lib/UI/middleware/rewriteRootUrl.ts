/*
 * This file is part of the Companion project
 * Copyright (c) 2025 Bitfocus AS
 * Authors: Julian Waller <git@julusian.co.uk>
 *
 * This program is free software.
 * You should have received a copy of the MIT licence as well as the Bitfocus
 * Individual Contributor License Agreement for companion along with
 * this program.
 */

import type Express from 'express'
// @ts-expect-error no types for this package
import onHeaders from 'on-headers'
import LogController from '../../Log/Controller.js'

export interface RewriteMiddlewareOptions {
	/**
	 * List of content types to process
	 * Defaults to HTML, CSS, and JS types
	 */
	contentTypes?: string[]
}

/**
 * Get the custom prefix from the companion-custom-prefix header
 * Validates the prefix to prevent path traversal attacks
 */
export function getCustomPrefixHeader(req: Express.Request): string {
	let customPrefixFromHeader = req.headers['companion-custom-prefix']
	if (customPrefixFromHeader?.includes('://') || customPrefixFromHeader?.includes('..'))
		customPrefixFromHeader = undefined // Don't allow custom prefixes that are not just a path

	return customPrefixFromHeader ? `/${customPrefixFromHeader}` : '/'
}

const DEFAULT_CONTENT_TYPES = [
	'text/html',
	'text/css',
	'application/javascript',
	'application/x-javascript',
	'text/javascript',
]

/**
 * Create a middleware that rewrites ROOT_URL_HERE placeholders in text responses
 *
 * This middleware:
 * - Forces accept-encoding: identity for downstream handlers to get uncompressed responses
 * - Buffers response data from downstream
 * - Checks Content-Type and only processes HTML/CSS/JS files
 * - Applies the configured replacements to the response body
 * - Strips any content-length headers from downstream (as the body may change size)
 * - Passes the modified response through (where compression middleware can compress it)
 */
export function createRewriteMiddleware(options: RewriteMiddlewareOptions = {}): Express.RequestHandler {
	const logger = LogController.createLogger('UI/Middleware/RewriteRootUrl')
	const contentTypes = options.contentTypes || DEFAULT_CONTENT_TYPES

	return (req, res, next) => {
		try {
			// Store original accept-encoding and force identity encoding for downstream
			const originalAcceptEncoding = req.headers['accept-encoding']
			req.headers['accept-encoding'] = 'identity'

			// If there is a prefix in the header, use that to customise the html response
			let processedPrefix = getCustomPrefixHeader(req)
			if (processedPrefix.endsWith('/')) processedPrefix = processedPrefix.slice(0, -1)

			let ended = false
			const responseBody: Buffer[] = []

			const _end = res.end.bind(res)

			// Check if we should process this response
			const shouldProcess = (): boolean => {
				const contentType = (res.getHeader('content-type') || '') as string
				const contentTypeLower = contentType.toLowerCase()
				return contentTypes.some((type) => contentTypeLower.includes(type.toLowerCase()))
			}

			// Override write to buffer response data
			res.write = function (chunk: any, encoding?: any, callback?: any): boolean {
				if (ended) return false

				if (chunk) {
					if (Buffer.isBuffer(chunk)) {
						responseBody.push(chunk)
					} else if (typeof chunk === 'string') {
						responseBody.push(Buffer.from(chunk))
					}
				}

				// Call the callback if provided to maintain flow control
				if (typeof encoding === 'function') {
					setImmediate(() => encoding(null))
					return true
				} else if (callback) {
					setImmediate(() => callback(null))
					return true
				}

				return true
			}

			// Override end to apply replacements and send final response
			res.end = function (chunk?: any, encoding?: any, callback?: any): typeof res {
				if (ended) return res
				ended = true

				// Append any final chunk to the response body
				if (chunk) {
					if (Buffer.isBuffer(chunk)) {
						responseBody.push(chunk)
					} else if (typeof chunk === 'string') {
						responseBody.push(Buffer.from(chunk))
					}
				}

				let finalBody: Buffer | string = Buffer.concat(responseBody)

				if (shouldProcess() && finalBody.length > 0) {
					// Replace ROOT_URL_HERE with the computed prefix
					finalBody = finalBody.toString().replace(/\/ROOT_URL_HERE/g, processedPrefix)
				}

				// Restore original accept-encoding
				req.headers['accept-encoding'] = originalAcceptEncoding

				// Send the final response
				return _end.call(res, finalBody, encoding, callback)
			}

			// Use onHeaders to remove Content-Length before headers are sent
			onHeaders(res, () => {
				if (shouldProcess()) {
					res.removeHeader('Content-Length')
				}
			})

			// Call next to let downstream handlers run
			next()
		} catch (error) {
			logger.error(`Error in rewrite middleware for ${req.url}: ${error}`)
			next(error)
		}
	}
}
