import { describe, expect, it } from 'vitest'
import { getCompiledIsVisibleExpressionFn } from '../IsVisible.js'
import type { IsVisibleUiFn } from '../Model/Options.js'

const noOptions = () => undefined

describe('getCompiledIsVisibleExpressionFn', () => {
	it('returns null for the function form', () => {
		const isVisibleUi: IsVisibleUiFn = { type: 'function', fn: '() => true' }
		expect(getCompiledIsVisibleExpressionFn(isVisibleUi)).toBeNull()
	})

	it('resolves an option reference (visible)', () => {
		const fn = getCompiledIsVisibleExpressionFn({ type: 'expression', fn: '$(options:mode) == "advanced"' })!
		expect(fn).not.toBeNull()
		expect(fn((name) => (name === 'mode' ? 'advanced' : undefined), undefined)).toBe(true)
	})

	it('resolves an option reference (hidden)', () => {
		const fn = getCompiledIsVisibleExpressionFn({ type: 'expression', fn: '$(options:mode) == "advanced"' })!
		expect(fn((name) => (name === 'mode' ? 'simple' : undefined), undefined)).toBe(false)
	})

	it('supports the $(this:) alias', () => {
		const fn = getCompiledIsVisibleExpressionFn({ type: 'expression', fn: '$(this:enabled)' })!
		expect(fn((name) => (name === 'enabled' ? true : undefined), undefined)).toBe(true)
		expect(fn(() => false, undefined)).toBe(false)
	})

	it('applies the string truthiness rules', () => {
		const fn = getCompiledIsVisibleExpressionFn({ type: 'expression', fn: '$(options:v)' })!
		// The strings "false" and "0" are treated as not-visible even though they are truthy in JS
		expect(fn(() => 'false', undefined)).toBe(false)
		expect(fn(() => '0', undefined)).toBe(false)
		expect(fn(() => '', undefined)).toBe(false)
		expect(fn(() => 'yes', undefined)).toBe(true)
		expect(fn(() => 1, undefined)).toBe(true)
	})

	it('resolves $(data:) references from the provided data', () => {
		const fn = getCompiledIsVisibleExpressionFn({ type: 'expression', fn: '$(data:flag)' })!
		expect(fn(noOptions, { flag: true })).toBe(true)
		expect(fn(noOptions, { flag: false })).toBe(false)
	})

	it('fails open (visible) when the option accessor throws', () => {
		const fn = getCompiledIsVisibleExpressionFn({ type: 'expression', fn: '$(options:mode) == "advanced"' })!
		expect(
			fn(() => {
				throw new Error('not allowed')
			}, undefined)
		).toBe(true)
	})

	it('fails open (visible) when a $(data:) reference is used but no data is provided', () => {
		const fn = getCompiledIsVisibleExpressionFn({ type: 'expression', fn: '$(data:flag)' })!
		expect(fn(noOptions, undefined)).toBe(true)
	})

	it('fails open (visible) for a malformed expression', () => {
		const fn = getCompiledIsVisibleExpressionFn({ type: 'expression', fn: '$(other:thing)' })!
		// `other` is not a permitted label, so evaluation throws and we fall back to visible
		expect(fn(noOptions, undefined)).toBe(true)
	})

	it('returns a stable (memoized) function for the same definition object', () => {
		const isVisibleUi: IsVisibleUiFn = { type: 'expression', fn: '$(options:mode)' }
		expect(getCompiledIsVisibleExpressionFn(isVisibleUi)).toBe(getCompiledIsVisibleExpressionFn(isVisibleUi))
	})
})
