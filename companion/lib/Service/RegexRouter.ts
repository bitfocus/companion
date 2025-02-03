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
	addRoute(route: string, handler: PathRouteHandler): void {
		this.#routes.push({
			regexp: new RegExp(`^${route}$`, 'i'),
			handler: (match, ...args) => handler(match.groups ?? {}, ...args),
		})
	}
}
