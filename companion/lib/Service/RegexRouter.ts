import { pathToRegexp } from 'path-to-regexp'

/**
 * A regex based route
 */
interface RegexRoute {
	regexp: RegExp
	handler: RouteHandler
}

type RouteReturnType = string | undefined | void

/**
 * Handler for a route
 */
type RouteHandler = (match: RegExpExecArray, ...args: any[]) => RouteReturnType | Promise<RouteReturnType>

type PathRouteHandler = (match: Record<string, string>, ...args: any[]) => RouteReturnType | Promise<RouteReturnType>

/**
 * Default route handler
 */
type DefaultRouteHandler = (path: string, ...args: any[]) => string | undefined

export class RegexRouter {
	readonly #defaultHandler: DefaultRouteHandler | undefined = undefined
	readonly #routes: RegexRoute[] = []

	constructor(defaultHandler?: DefaultRouteHandler) {
		this.#defaultHandler = defaultHandler
	}

	/**
	 * Handle a received message
	 */
	async processMessage(path: string, ...args: any[]): Promise<RouteReturnType> {
		for (const route of this.#routes) {
			const match = route.regexp.exec(path)
			if (match) {
				return route.handler(match, ...args)
			}
		}

		if (this.#defaultHandler) {
			return this.#defaultHandler(path, ...args)
		} else {
			return undefined
		}
	}

	/**
	 * Add a route to the router
	 */
	addRegex(regexp: RegExp, handler: RouteHandler): void {
		if (!regexp || !handler) throw new Error('Invalid route parameters')
		this.#routes.push({ regexp, handler })
	}

	/**
	 * Add a route to the router, using the express style path syntax
	 */
	addPath(path: string, handler: PathRouteHandler): void {
		const { regexp, keys } = pathToRegexp(path)

		this.addRegex(regexp, async (match, ...args) => {
			const values: Record<string, string> = {}
			for (let i = 0; i < keys.length; i++) {
				const key = keys[i]
				values[key.name] = values[key.name] ?? match[i + 1]
			}

			return handler(values, ...args)
		})
	}
}
