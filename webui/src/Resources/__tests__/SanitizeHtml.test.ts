import { describe, expect, test } from 'vitest'
import { sanitizeHtmlString } from '../SanitizeHtml.js'

describe('sanitizeHtmlString', () => {
	test('passes through plain text', () => {
		expect(sanitizeHtmlString('Hello world')).toBe('Hello world')
	})

	test('preserves allowed formatting tags', () => {
		expect(sanitizeHtmlString('<p>Hello <b>bold</b> and <i>italic</i></p>')).toBe(
			'<p>Hello <b>bold</b> and <i>italic</i></p>'
		)
	})

	describe('disallowed tags', () => {
		test('escapes disallowed tags rather than dropping them', () => {
			expect(sanitizeHtmlString('<script>alert(1)</script>')).toBe('&lt;script&gt;alert(1)&lt;/script&gt;')
		})

		test('keeps the text content of disallowed tags visible', () => {
			expect(sanitizeHtmlString('before <unknown>middle</unknown> after')).toBe(
				'before &lt;unknown&gt;middle&lt;/unknown&gt; after'
			)
		})
	})

	describe('anchor mangling', () => {
		test('forces target=_blank and rel=noopener noreferrer', () => {
			expect(sanitizeHtmlString('<a href="https://example.com">link</a>')).toBe(
				'<a href="https://example.com" target="_blank" rel="noopener noreferrer">link</a>'
			)
		})

		test('overrides an existing target and rel', () => {
			expect(sanitizeHtmlString('<a href="https://example.com" target="_self" rel="author">link</a>')).toBe(
				'<a href="https://example.com" target="_blank" rel="noopener noreferrer">link</a>'
			)
		})

		test('strips javascript: hrefs but keeps the anchor', () => {
			expect(sanitizeHtmlString('<a href="javascript:alert(1)">link</a>')).toBe(
				'<a target="_blank" rel="noopener noreferrer">link</a>'
			)
		})

		test('strips non http(s) schemes such as mailto:', () => {
			expect(sanitizeHtmlString('<a href="mailto:me@example.com">email</a>')).toBe(
				'<a target="_blank" rel="noopener noreferrer">email</a>'
			)
		})

		test('keeps http and https hrefs', () => {
			expect(sanitizeHtmlString('<a href="http://example.com">link</a>')).toBe(
				'<a href="http://example.com" target="_blank" rel="noopener noreferrer">link</a>'
			)
		})
	})

	describe('images disabled (default)', () => {
		test('escapes img tags when allowImages is not set', () => {
			expect(sanitizeHtmlString('<img src="https://example.com/a.png">')).toBe(
				'&lt;img src="https://example.com/a.png" /&gt;'
			)
		})

		test('escapes img tags when allowImages is false', () => {
			expect(sanitizeHtmlString('<img src="https://example.com/a.png">', { allowImages: false })).toBe(
				'&lt;img src="https://example.com/a.png" /&gt;'
			)
		})
	})

	describe('images enabled', () => {
		test('keeps http(s) img sources', () => {
			expect(sanitizeHtmlString('<img src="https://example.com/a.png" />', { allowImages: true })).toBe(
				'<img src="https://example.com/a.png" />'
			)
		})

		test('keeps inline data: img sources', () => {
			const dataUri = 'data:image/png;base64,iVBORw0KGgo='
			expect(sanitizeHtmlString(`<img src="${dataUri}" />`, { allowImages: true })).toBe(`<img src="${dataUri}" />`)
		})

		test('strips javascript: img sources', () => {
			expect(sanitizeHtmlString('<img src="javascript:alert(1)" />', { allowImages: true })).toBe('<img />')
		})
	})
})
