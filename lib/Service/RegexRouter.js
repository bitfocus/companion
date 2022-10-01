import { pathToRegexp } from 'path-to-regexp'

class RegexRouter {
	#defaultHandler = undefined

	#routes = []

	constructor(defaultHandler) {
		this.#defaultHandler = defaultHandler
	}

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

	addRegex(regexp, handler) {
		this.#routes.push({ regexp, handler })
	}

	addPath(path, handler) {
		const keys = []
		const regexp = pathToRegexp(path, keys)

		this.addRegex(regexp, (match, ...args) => {
			const values = {}
			for (let i = 0; i < keys.length; i++) {
				const key = keys[i]
				values[key.name] = match[i + 1]
			}

			return handler(values, ...args)
		})
	}
}

export default RegexRouter
