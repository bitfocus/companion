import { pathToRegexp } from 'path-to-regexp'

/**
 * A regex based route
 * @typedef {{regexp: RegExp, handler: RouteHandler }} RegexRoute
 */

/**
 * Handler for a route
 * @typedef {(match: RegExpExecArray, ...args: any[]) => any} RouteHandler
 */

/**
 * Default route handler
 * @typedef {(path: string, ...args: any[]) => void} DefaultRouteHandler
 */

class RegexRouter {
	/**
	 * @type {DefaultRouteHandler | undefined}
	 */
	#defaultHandler = undefined

	/**
	 * @type {RegexRoute[]}
	 */
	#routes = []

	/**
	 * @param {DefaultRouteHandler=} defaultHandler
	 */
	constructor(defaultHandler) {
		this.#defaultHandler = defaultHandler
	}

	/**
	 * Handle a received message
	 * @param {string} path
	 * @param  {...any} args
	 */
	processMessage(path, ...args) {
		for (const route of this.#routes) {
			const match = route.regexp.exec(path)
			if (match) {
				return route.handler(match, ...args)
			}
		}

		if (this.#defaultHandler) {
			return this.#defaultHandler(path, ...args)
		}
	}

	/**
	 * Add a route to the router
	 * @param {RegExp} regexp
	 * @param {RouteHandler} handler
	 */
	addRegex(regexp, handler) {
		this.#routes.push({ regexp, handler })
	}

	/**
	 * Add a route to the router, using the express style path syntax
	 * @param {string} path
	 * @param {(match: Record<string, string>, ...args: any[]) => void} handler
	 */
	addPath(path, handler) {
		/**
		 * @type {import ('path-to-regexp').Key[] }
		 */
		const keys = []
		const regexp = pathToRegexp(path, keys)

		this.addRegex(regexp, (match, ...args) => {
			/**
			 * @type {Record<string, string>}
			 */
			const values = {}
			for (let i = 0; i < keys.length; i++) {
				const key = keys[i]
				// @ts-ignore
				values[key.name] = match[i + 1]
			}

			return handler(values, ...args)
		})
	}
}

export default RegexRouter
