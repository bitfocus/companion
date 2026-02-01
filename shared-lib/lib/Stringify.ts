/** Make a string out of an error (or other equivalents), including any additional data such as stack trace if available */
export function stringifyError(error: unknown, noStack = false): string {
	let str: string | undefined = undefined

	if (error && typeof error === 'object') {
		if (Array.isArray(error)) {
			return error.map((e) => stringifyError(e, noStack)).join(', ')
		}

		if ((error as any).toString && (error as any).toString !== Object.prototype.toString) {
			// Has a custom toString() method
			str = `${(error as any).toString()}`
		} else {
			const strings: (string | undefined)[] = [
				stringify((error as Error).message), // Error
				stringify((error as any).details),
			]
			str = strings.filter(Boolean).join(', ')
		}

		if (!str) {
			try {
				// Try to stringify the object:
				str = JSON.stringify(error)
			} catch (e) {
				str = `${error as any} (stringifyError: ${e})`
			}
		}

		// Is an instance of a class (like KeyboardEvent):
		const instanceName = error.constructor?.name
		if (instanceName && instanceName !== 'Object' && instanceName !== 'Array') str = `${instanceName}: ${str}`
	} else {
		str = `${error}`
	}

	if (!noStack) {
		if (error && typeof error === 'object' && typeof (error as any).stack === 'string') {
			str += ', ' + (error as any).stack
		}
	}

	if (str.startsWith('Error: ')) str = str.slice('Error: '.length)

	return str
}

function stringify(v: any): string | undefined {
	// Tries to stringify objects if they have a toString() that returns something sensible
	if (v === undefined) return undefined
	if (v === null) return 'null'

	if (typeof v === 'object') {
		const str = `${v}`
		if (str !== '[object Object]') return str
		return undefined
	} else return `${v}`
}
