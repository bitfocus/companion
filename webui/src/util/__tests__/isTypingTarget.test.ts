import { describe, expect, it } from 'vitest'
import { isTypingTarget } from '../isTypingTarget.js'

describe('isTypingTarget', () => {
	it.each([
		['a text field', document.createElement('input')],
		['a text area', document.createElement('textarea')],
	])('leaves %s alone', (_name, element) => {
		expect(isTypingTarget(element)).toBe(true)
	})

	it('leaves anything being edited in place alone', () => {
		const element = document.createElement('div')
		element.contentEditable = 'true'
		// jsdom does not work `isContentEditable` out from the attribute
		Object.defineProperty(element, 'isContentEditable', { value: true })

		expect(isTypingTarget(element)).toBe(true)
	})

	it('leaves the expression editor alone, which is neither', () => {
		const element = document.createElement('div')
		element.classList.add('native-edit-context')

		expect(isTypingTarget(element)).toBe(true)
	})

	it('answers for anything else, including nothing at all', () => {
		expect(isTypingTarget(document.createElement('div'))).toBe(false)
		expect(isTypingTarget(null)).toBe(false)
		expect(isTypingTarget(new EventTarget())).toBe(false)
	})
})
