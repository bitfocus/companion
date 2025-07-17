const freezePrototypes = () => {
	if (Object.isFrozen(console)) {
		return
	}

	// freeze global objects that can be used within the sandbox
	Object.freeze(console)
	Object.freeze(Array.prototype)
	// Object.freeze(Function.prototype) // TODO - this should be enabled, but breaks mobx...
	// @ts-expect-error Suppress error
	Object.freeze(Math.prototype)
	Object.freeze(Number.prototype)
	Object.freeze(Object.prototype)
	Object.freeze(RegExp.prototype)
	Object.freeze(String.prototype)
	Object.freeze(Symbol.prototype)

	// prevent constructors of async/generator functions to bypass sandbox
	// @ts-expect-error Suppress error
	Object.freeze(async function () {}.__proto__)
	// @ts-expect-error Suppress error
	Object.freeze(async function* () {}.__proto__)
	// @ts-expect-error Suppress error
	Object.freeze(function* () {}.__proto__)
	// @ts-expect-error Suppress error
	Object.freeze(function* () {}.__proto__.prototype)
	// @ts-expect-error Suppress error
	Object.freeze(async function* () {}.__proto__.prototype)
}

export function sandbox(serializedFn: string): (...args: any[]) => any {
	// proxy handler
	const proxyHandler = {
		has: () => true,
		get: (obj: any, prop: any) => Reflect.get(obj, prop),
	}

	// global objects that will be allowed within the sandbox
	const allowList = {
		__proto__: null,
		console,
		Array,
		Math,
		Number,
		Object,
		RegExp,
		String,
		Symbol,
	}

	// limit scope and prevent `window` leak
	const src = `
		with (catchAllProxy) {
			with (configProxy) {
				return (() => {
					"use strict"
					const fn = ${serializedFn}
					return fn(arg0, arg1)
				})()
			}
		}
	`

	freezePrototypes()

	try {
		// eslint-disable-next-line @typescript-eslint/no-implied-eval
		const scopedFn = new Function('catchAllProxy', src)

		return (arg0, arg1) => {
			// create a sandboxed/proxy version of the context passed to the function
			const configProxy = new Proxy({ ...allowList, arg0, arg1 }, proxyHandler)
			const catchAllProxy = new Proxy({ __proto__: null, configProxy }, proxyHandler)
			// call scoped function with context that only includes config
			return scopedFn(catchAllProxy)
		}
	} catch (error) {
		// log error and gracefully exit
		console.log(`Sandbox: ${error}`)
		return () => true
	}
}
