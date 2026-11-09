import { describe, expect, test, vi } from 'vitest'
import { RegexRouter } from '../../lib/Service/RegexRouter.js'

describe('RegexRouter', () => {
	describe('processMessage', () => {
		test('no match without default handler', async () => {
			const router = new RegexRouter()
			router.addPath('/abc', vi.fn())

			await expect(router.processMessage('/def')).resolves.toBeUndefined()
		})

		test('no match calls default handler', async () => {
			const defaultHandler = vi.fn(() => 'default')
			const router = new RegexRouter(defaultHandler)
			const handler = vi.fn()
			router.addPath('/abc', handler)

			await expect(router.processMessage('/def', 1, 'two')).resolves.toBe('default')

			expect(defaultHandler).toHaveBeenCalledTimes(1)
			expect(defaultHandler).toHaveBeenCalledWith('/def', 1, 'two')
			expect(handler).toHaveBeenCalledTimes(0)
		})

		test('default handler error propagates', async () => {
			const router = new RegexRouter(() => {
				throw new Error('Syntax error')
			})

			await expect(router.processMessage('/def')).rejects.toThrow('Syntax error')
		})

		test('first matching route wins', async () => {
			const defaultHandler = vi.fn()
			const router = new RegexRouter(defaultHandler)
			const first = vi.fn(() => 'first')
			const second = vi.fn(() => 'second')
			router.addPath('/a/:id', first)
			router.addPath('/a/:other', second)

			await expect(router.processMessage('/a/1')).resolves.toBe('first')

			expect(first).toHaveBeenCalledTimes(1)
			expect(second).toHaveBeenCalledTimes(0)
			expect(defaultHandler).toHaveBeenCalledTimes(0)
		})

		test('returns async handler result', async () => {
			const router = new RegexRouter()
			router.addPath('/a', async () => 'done')

			await expect(router.processMessage('/a')).resolves.toBe('done')
		})

		test('async handler rejection propagates', async () => {
			const router = new RegexRouter()
			router.addPath('/a', async () => {
				throw new Error('failed')
			})

			await expect(router.processMessage('/a')).rejects.toThrow('failed')
		})
	})

	describe('addRegex', () => {
		test('passes match and args', async () => {
			const router = new RegexRouter()
			const handler = vi.fn(() => 'ok')
			router.addRegex(/^\/a\/(\d+)$/, handler)

			await expect(router.processMessage('/a/12', 'arg')).resolves.toBe('ok')

			expect(handler).toHaveBeenCalledTimes(1)
			const [match, arg] = handler.mock.calls[0] as unknown as [RegExpExecArray, string]
			expect(match[1]).toBe('12')
			expect(arg).toBe('arg')
		})

		test('invalid parameters', () => {
			const router = new RegexRouter()
			expect(() => router.addRegex(null as any, vi.fn())).toThrow('Invalid route parameters')
			expect(() => router.addRegex(/a/, null as any)).toThrow('Invalid route parameters')
		})
	})

	describe('addPath', () => {
		async function runPath(path: string, input: string): Promise<Record<string, string> | null> {
			const router = new RegexRouter(() => 'no-match')
			let values: Record<string, string> | null = null
			router.addPath(path, (match) => {
				values = match
				return 'match'
			})

			const result = await router.processMessage(input)
			if (result === 'no-match') return null
			return values
		}

		test('passes args to handler', async () => {
			const router = new RegexRouter()
			const handler = vi.fn()
			router.addPath('/a/:id', handler)

			await router.processMessage('/a/1', 'arg1', 2)

			expect(handler).toHaveBeenCalledTimes(1)
			expect(handler).toHaveBeenCalledWith({ id: '1' }, 'arg1', 2)
		})

		describe('slash separated', () => {
			test('params', async () => {
				expect(await runPath('/location/:page/:row/:column/press', '/location/1/2/3/press')).toEqual({
					page: '1',
					row: '2',
					column: '3',
				})
			})

			test('no params', async () => {
				expect(await runPath('/surfaces/rescan', '/surfaces/rescan')).toEqual({})
			})

			test('case insensitive', async () => {
				expect(await runPath('/location/:page/press', '/LOCATION/1/Press')).toEqual({ page: '1' })
			})

			test('trailing slash', async () => {
				expect(await runPath('/press/bank/:page/:bank', '/press/bank/1/2/')).toEqual({ page: '1', bank: '2' })
			})

			test('param does not span slash', async () => {
				expect(await runPath('/press/bank/:page/:bank', '/press/bank/1/2/3')).toBeNull()
				expect(await runPath('/custom-variable/:name/value', '/custom-variable/a/b/value')).toBeNull()
			})

			test('missing segment', async () => {
				expect(await runPath('/press/bank/:page/:bank', '/press/bank/1')).toBeNull()
				expect(await runPath('/press/bank/:page/:bank', '/press/bank/1/')).toBeNull()
			})

			test('anchored', async () => {
				expect(await runPath('/surfaces/rescan', '/surfaces/rescan/now')).toBeNull()
				expect(await runPath('/surfaces/rescan', '/x/surfaces/rescan')).toBeNull()
			})

			test('param is not decoded', async () => {
				expect(await runPath('/custom-variable/:name/value', '/custom-variable/a%20b/value')).toEqual({
					name: 'a%20b',
				})
			})

			test('param with spaces and symbols', async () => {
				expect(await runPath('/custom-variable/:name/value', '/custom-variable/a b.c-d:e/value')).toEqual({
					name: 'a b.c-d:e',
				})
			})
		})

		describe('space separated', () => {
			test('params', async () => {
				expect(await runPath('bank-press :page :bank', 'bank-press 1 2')).toEqual({ page: '1', bank: '2' })
				expect(await runPath('bank-step :page :bank :step', 'bank-step 1 2 3')).toEqual({
					page: '1',
					bank: '2',
					step: '3',
				})
			})

			test('mixed with slashes', async () => {
				expect(await runPath('location :page/:row/:column set-step :step', 'location 1/2/3 set-step 4')).toEqual({
					page: '1',
					row: '2',
					column: '3',
					step: '4',
				})
			})

			test('no params', async () => {
				expect(await runPath('surfaces rescan', 'surfaces rescan')).toEqual({})
				expect(await runPath('surfaces rescan', 'surfaces  rescan')).toBeNull()
			})

			test('case insensitive', async () => {
				expect(await runPath('page-set :page :surfaceId', 'PAGE-SET 2 abc')).toEqual({ page: '2', surfaceId: 'abc' })
			})

			test('missing param', async () => {
				expect(await runPath('page-set :page :surfaceId', 'page-set 1')).toBeNull()
				expect(await runPath('location :page/:row/:column press', 'location 1/2 press')).toBeNull()
			})

			test('trailing text', async () => {
				expect(await runPath('location :page/:row/:column press', 'location 1/2/3 press x')).toBeNull()
			})

			test('last adjacent param takes the remainder', async () => {
				expect(await runPath('page-set :page :surfaceId', 'page-set 1 my surface')).toEqual({
					page: '1',
					surfaceId: 'my surface',
				})
				expect(await runPath('bank-step :page :bank :step', 'bank-step 1 2 3 4')).toEqual({
					page: '1',
					bank: '2',
					step: '3 4',
				})
			})

			test('param before literal can contain spaces', async () => {
				expect(await runPath('surface :surfaceId page-set :page', 'surface my surface page-set 3')).toEqual({
					surfaceId: 'my surface',
					page: '3',
				})
				expect(await runPath('custom-variable :name get-value', 'custom-variable a b get-value')).toEqual({
					name: 'a b',
				})
			})

			test('param after literal can contain spaces', async () => {
				expect(
					await runPath('location :page/:row/:column style color :color', 'location 1/2/3 style color rgb(1, 2, 3)')
				).toEqual({
					page: '1',
					row: '2',
					column: '3',
					color: 'rgb(1, 2, 3)',
				})
			})

			test('param with literal prefix', async () => {
				expect(await runPath('style bank :page :bank bgcolor #:color', 'style bank 1 2 bgcolor #ff0000')).toEqual({
					page: '1',
					bank: '2',
					color: 'ff0000',
				})
				expect(await runPath('style bank :page :bank bgcolor #:color', 'style bank 1 2 bgcolor ff0000')).toBeNull()
			})
		})

		describe('optional wildcard', () => {
			const path = 'location :page/:row/:column style text{ *text}'

			test('present', async () => {
				expect(await runPath(path, 'location 1/2/3 style text hello world')).toEqual({
					page: '1',
					row: '2',
					column: '3',
					text: 'hello world',
				})
			})

			test('spans slashes', async () => {
				expect(await runPath(path, 'location 1/2/3 style text a/b/c')).toEqual({
					page: '1',
					row: '2',
					column: '3',
					text: 'a/b/c',
				})
			})

			test('keeps extra spaces', async () => {
				expect(await runPath(path, 'location 1/2/3 style text  two  spaces')).toEqual({
					page: '1',
					row: '2',
					column: '3',
					text: ' two  spaces',
				})
			})

			test('absent', async () => {
				expect(await runPath(path, 'location 1/2/3 style text')).toEqual({
					page: '1',
					row: '2',
					column: '3',
					text: undefined,
				})
			})

			test('empty', async () => {
				expect(await runPath(path, 'location 1/2/3 style text ')).toBeNull()
			})
		})

		describe('wildcard in group', () => {
			const path = 'custom-variable :name set-value {*value}'

			test('value', async () => {
				expect(await runPath(path, 'custom-variable a set-value 1 2/3')).toEqual({ name: 'a', value: '1 2/3' })
			})

			test('empty value', async () => {
				expect(await runPath(path, 'custom-variable a set-value ')).toEqual({ name: 'a', value: undefined })
			})

			test('missing separator', async () => {
				expect(await runPath(path, 'custom-variable a set-value')).toBeNull()
			})

			test('value containing the literal', async () => {
				expect(await runPath(path, 'custom-variable a set-value x set-value y')).toEqual({
					name: 'a',
					value: 'x set-value y',
				})
			})
		})
	})
})
