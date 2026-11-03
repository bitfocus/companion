import { describe, expect, it } from 'vitest'
import { stringifyError } from '../Stringify.js'

class NamedError extends Error {
	constructor(message: string) {
		super(message)
		this.name = 'NamedError'
	}
}

class SomeEvent {
	readonly message = 'happened'
}

describe('stringifyError', () => {
	it.each([
		['an Error', new Error('boom'), 'boom'],
		['a built-in Error subclass', new TypeError('boom'), 'TypeError: boom'],
		['an Error subclass with its own name', new NamedError('boom'), 'NamedError: boom'],
		['an instance of another class', new SomeEvent(), 'SomeEvent: happened'],
		['an object with a message', { message: 'boom' }, 'boom'],
		['an object with details', { message: 'boom', details: 'more' }, 'boom, more'],
		['an object without a message', { a: 1 }, '{"a":1}'],
		['an array', [new Error('a'), 'b'], 'a, b'],
		['a string', 'boom', 'boom'],
		['undefined', undefined, 'undefined'],
	])('stringifies %s', (_name, error, expected) => {
		expect(stringifyError(error, true)).toBe(expected)
	})

	it('appends the stack unless asked not to', () => {
		const error = new Error('boom')
		expect(stringifyError(error)).toBe(`boom, ${error.stack}`)
		expect(stringifyError(error, true)).toBe('boom')
	})
})
