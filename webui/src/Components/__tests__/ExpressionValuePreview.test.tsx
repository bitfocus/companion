import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ExpressionStreamResult } from '@companion-app/shared/Expression/ExpressionResult.js'
import { exprExpr, exprVal, type SomeCompanionInputField } from '@companion-app/shared/Model/Options.js'
import {
	buildContextResolutionForPreview,
	ExpressionPreviewResult,
	ExpressionValuePreview,
} from '../ExpressionValuePreview.js'

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

// Must be hoisted so the mock factory can capture the ref before imports run.
const subscriptionDataRef = vi.hoisted(() => ({ current: undefined as ExpressionStreamResult | undefined }))

vi.mock('@trpc/tanstack-react-query', () => ({
	useSubscription: vi.fn(() => ({ data: subscriptionDataRef.current })),
}))

// Reset subscription mock implementation before each test so that mockReturnValue
// calls in one test don't bleed into the next.
beforeEach(async () => {
	const { useSubscription } = await import('@trpc/tanstack-react-query')
	vi.mocked(useSubscription).mockImplementation(() => ({ data: subscriptionDataRef.current }) as any)
	subscriptionDataRef.current = undefined
})

vi.mock('~/Resources/TRPC.js', () => ({
	trpc: {
		preview: {
			expressionStream: {
				watchExpression: {
					subscriptionOptions: vi.fn(() => ({})),
				},
			},
		},
	},
}))

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function textField(overrides: Partial<SomeCompanionInputField> = {}): SomeCompanionInputField {
	return {
		type: 'textinput',
		id: 'value',
		label: 'Value',
		default: '',
		...overrides,
	} as SomeCompanionInputField
}

function renderPreview(expression: string, field = textField()) {
	return render(<ExpressionValuePreview expression={expression} controlId={null} fieldDefinition={field} />)
}

// ---------------------------------------------------------------------------
// buildContextResolutionForPreview
// ---------------------------------------------------------------------------

describe('buildContextResolutionForPreview', () => {
	it('returns undefined when res is undefined', () => {
		expect(buildContextResolutionForPreview(undefined, {})).toBeUndefined()
	})

	it('returns undefined when allRawOptions is undefined', () => {
		expect(buildContextResolutionForPreview({ type: 'customVariable', nameFieldId: 'name' }, undefined)).toBeUndefined()
	})

	describe('customVariable', () => {
		it('extracts name from the options', () => {
			const result = buildContextResolutionForPreview(
				{ type: 'customVariable', nameFieldId: 'name' },
				{ name: exprVal('myVar') }
			)
			expect(result).toEqual({ type: 'customVariable', nameValue: exprVal('myVar') })
		})

		it('returns undefined nameValue when the field is absent', () => {
			const result = buildContextResolutionForPreview({ type: 'customVariable', nameFieldId: 'name' }, {})
			expect(result).toEqual({ type: 'customVariable', nameValue: undefined })
		})

		it('passes expression-mode values through unchanged for the server to evaluate', () => {
			const result = buildContextResolutionForPreview(
				{ type: 'customVariable', nameFieldId: 'name' },
				{ name: exprExpr('$(custom:dynamicName)') }
			)
			expect(result).toEqual({ type: 'customVariable', nameValue: exprExpr('$(custom:dynamicName)') })
		})

		it('passes numeric raw values through unchanged', () => {
			const result = buildContextResolutionForPreview(
				{ type: 'customVariable', nameFieldId: 'name' },
				{ name: exprVal(42) }
			)
			expect(result).toEqual({ type: 'customVariable', nameValue: exprVal(42) })
		})

		it('respects a non-default nameFieldId', () => {
			const result = buildContextResolutionForPreview(
				{ type: 'customVariable', nameFieldId: 'variableName' },
				{ variableName: exprVal('myCustomVar'), name: exprVal('shouldBeIgnored') }
			)
			expect(result).toEqual({ type: 'customVariable', nameValue: exprVal('myCustomVar') })
		})
	})

	describe('localVariable', () => {
		it('extracts both location and name from the options', () => {
			const result = buildContextResolutionForPreview(
				{ type: 'localVariable', locationFieldId: 'location', nameFieldId: 'name' },
				{ location: exprVal('this'), name: exprVal('counter') }
			)
			expect(result).toEqual({ type: 'localVariable', locationValue: exprVal('this'), nameValue: exprVal('counter') })
		})

		it('returns undefined locationValue when the field is absent', () => {
			const result = buildContextResolutionForPreview(
				{ type: 'localVariable', locationFieldId: 'location', nameFieldId: 'name' },
				{ name: exprVal('counter') }
			)
			expect(result).toEqual({ type: 'localVariable', locationValue: undefined, nameValue: exprVal('counter') })
		})

		it('returns undefined nameValue when the field is absent', () => {
			const result = buildContextResolutionForPreview(
				{ type: 'localVariable', locationFieldId: 'location', nameFieldId: 'name' },
				{ location: exprVal('this') }
			)
			expect(result).toEqual({ type: 'localVariable', locationValue: exprVal('this'), nameValue: undefined })
		})

		it('supports a page/row/col location string', () => {
			const result = buildContextResolutionForPreview(
				{ type: 'localVariable', locationFieldId: 'location', nameFieldId: 'name' },
				{ location: exprVal('1/2/3'), name: exprVal('myVar') }
			)
			expect(result).toEqual({ type: 'localVariable', locationValue: exprVal('1/2/3'), nameValue: exprVal('myVar') })
		})

		it('returns undefined for both fields when both are absent', () => {
			const result = buildContextResolutionForPreview(
				{ type: 'localVariable', locationFieldId: 'location', nameFieldId: 'name' },
				{}
			)
			expect(result).toEqual({ type: 'localVariable', locationValue: undefined, nameValue: undefined })
		})

		it('respects non-default locationFieldId and nameFieldId', () => {
			const result = buildContextResolutionForPreview(
				{ type: 'localVariable', locationFieldId: 'loc', nameFieldId: 'varName' },
				{
					loc: exprVal('this'),
					varName: exprVal('counter'),
					location: exprVal('shouldBeIgnored'),
					name: exprVal('shouldBeIgnored'),
				}
			)
			expect(result).toEqual({ type: 'localVariable', locationValue: exprVal('this'), nameValue: exprVal('counter') })
		})
	})
})

// ---------------------------------------------------------------------------
// ExpressionPreviewResult — pure display component
// ---------------------------------------------------------------------------

describe('ExpressionPreviewResult', () => {
	it('renders the string value', () => {
		render(<ExpressionPreviewResult data={{ ok: true, value: 'hello world' }} fieldDefinition={textField()} />)
		expect(document.body.textContent).toContain('hello world')
	})

	it('renders a numeric value', () => {
		render(<ExpressionPreviewResult data={{ ok: true, value: 42 }} fieldDefinition={textField()} />)
		expect(document.body.textContent).toContain('42')
	})

	it('renders a boolean value', () => {
		render(<ExpressionPreviewResult data={{ ok: true, value: true }} fieldDefinition={textField()} />)
		expect(document.body.textContent).toContain('true')
	})

	it('renders undefined value without crashing', () => {
		render(<ExpressionPreviewResult data={{ ok: true, value: undefined }} fieldDefinition={textField()} />)
	})

	it('renders an error alert when ok is false', () => {
		render(<ExpressionPreviewResult data={{ ok: false, error: 'division by zero' }} fieldDefinition={textField()} />)
		expect(screen.getByText(/division by zero/)).toBeInTheDocument()
	})

	it('does not show a validation error when the value is valid for the field type', () => {
		render(
			<ExpressionPreviewResult
				data={{ ok: true, value: 50 }}
				fieldDefinition={textField({ type: 'number', min: 0, max: 100 } as any)}
			/>
		)
		expect(screen.queryByTitle(/invalid/i)).toBeNull()
	})

	it('shows a validation error when the value is out of range', () => {
		render(
			<ExpressionPreviewResult
				data={{ ok: true, value: 999 }}
				fieldDefinition={{ type: 'number', id: 'n', label: 'N', default: 0, min: 0, max: 10 }}
			/>
		)
		expect(document.body.textContent).toContain('999')
	})

	it('skips validation when allowInvalidValues is set', () => {
		render(
			<ExpressionPreviewResult
				data={{ ok: true, value: 9999 }}
				fieldDefinition={textField({ type: 'number', min: 0, max: 10, allowInvalidValues: true } as any)}
			/>
		)
		expect(document.body.textContent).toContain('9999')
	})
})

// ---------------------------------------------------------------------------
// ExpressionValuePreview — outer shell (no subscription needed for these)
// ---------------------------------------------------------------------------

describe('ExpressionValuePreview — static states', () => {
	it('renders nothing for an empty expression', () => {
		const { container } = renderPreview('')
		expect(container.firstChild).toBeNull()
	})

	it('renders nothing for a whitespace-only expression', () => {
		const { container } = renderPreview('   ')
		expect(container.firstChild).toBeNull()
	})

	it('renders an "Invalid expression" warning for unparseable syntax', () => {
		renderPreview('1 + + +')
		expect(screen.getByText(/invalid expression/i)).toBeInTheDocument()
	})

	it('does not show the invalid warning for a valid expression', () => {
		subscriptionDataRef.current = { ok: true, value: 'x' }
		renderPreview('1 + 2')
		expect(screen.queryByText(/invalid expression/i)).toBeNull()
	})
})

// ---------------------------------------------------------------------------
// ExpressionValuePreview — subscription states (spinner timing)
// ---------------------------------------------------------------------------

// useDebounced initialises with the current value, so ExpressionValuePreviewInner
// mounts immediately. The debounce only throttles *subsequent* expression changes.
// The spinner timer (200ms) starts at mount time.

describe('ExpressionValuePreview — subscription states (spinner timing)', () => {
	beforeEach(() => {
		vi.useFakeTimers()
		subscriptionDataRef.current = undefined
	})

	afterEach(() => {
		vi.useRealTimers()
		subscriptionDataRef.current = undefined
	})

	it('renders nothing before the 200ms spinner delay', () => {
		const { container } = renderPreview('1 + 2')
		expect(container.querySelector('.mt-1')).toBeNull()
	})

	it('shows a spinner after 200ms with no data', async () => {
		renderPreview('1 + 2')
		await act(() => vi.advanceTimersByTime(200))
		expect(screen.getByTitle('Loading preview')).toBeInTheDocument()
	})

	it('hides the spinner when data arrives after it was showing', async () => {
		const { rerender } = renderPreview('1 + 2')
		await act(() => vi.advanceTimersByTime(200))
		expect(screen.getByTitle('Loading preview')).toBeInTheDocument()

		const { useSubscription } = await import('@trpc/tanstack-react-query')
		vi.mocked(useSubscription).mockReturnValue({ data: { ok: true, value: 'loaded' } } as any)
		act(() => rerender(<ExpressionValuePreview expression="1 + 2" controlId={null} fieldDefinition={textField()} />))

		expect(screen.queryByTitle('Loading preview')).toBeNull()
		expect(document.body.textContent).toContain('loaded')
	})

	it('debounces expression changes — inner component sees stable value during rapid changes', async () => {
		const { trpc } = await import('~/Resources/TRPC.js')
		const optionsSpy = vi.mocked(trpc.preview.expressionStream.watchExpression.subscriptionOptions)

		const { rerender } = renderPreview('1')
		optionsSpy.mockClear()

		rerender(<ExpressionValuePreview expression="1 +" controlId={null} fieldDefinition={textField()} />)
		rerender(<ExpressionValuePreview expression="1 + 2" controlId={null} fieldDefinition={textField()} />)

		expect(optionsSpy.mock.calls.every((c) => (c[0] as any).expression === '1')).toBe(true)

		await act(() => vi.advanceTimersByTime(300))
		const lastCall = optionsSpy.mock.calls[optionsSpy.mock.calls.length - 1]
		expect(lastCall[0]).toMatchObject({ expression: '1 + 2' })
	})
})

// ---------------------------------------------------------------------------
// ExpressionValuePreview — subscription states (data)
// ---------------------------------------------------------------------------

describe('ExpressionValuePreview — subscription states (data)', () => {
	afterEach(() => {
		subscriptionDataRef.current = undefined
	})

	it('shows the result when subscription data arrives', () => {
		subscriptionDataRef.current = { ok: true, value: 'result value' }
		renderPreview('1 + 2')
		expect(document.body.textContent).toContain('result value')
	})

	it('shows an error alert when the subscription returns ok:false', () => {
		subscriptionDataRef.current = { ok: false, error: 'unknown variable' }
		renderPreview('$(bad:var)')
		expect(document.body.textContent).toContain('unknown variable')
	})

	it('retains the last result while re-fetching', async () => {
		const { useSubscription } = await import('@trpc/tanstack-react-query')
		const mockedSub = vi.mocked(useSubscription)

		mockedSub.mockReturnValue({ data: { ok: true, value: 'stale result' } } as any)
		const { rerender } = render(
			<ExpressionValuePreview expression="1 + 2" controlId={null} fieldDefinition={textField()} />
		)
		expect(document.body.textContent).toContain('stale result')

		mockedSub.mockReturnValue({ data: undefined } as any)
		rerender(<ExpressionValuePreview expression="2 + 3" controlId={null} fieldDefinition={textField()} />)
		expect(document.body.textContent).toContain('stale result')
	})

	it('passes contextResolution through to the subscription', async () => {
		const { trpc } = await import('~/Resources/TRPC.js')
		const optionsSpy = vi.mocked(trpc.preview.expressionStream.watchExpression.subscriptionOptions)

		subscriptionDataRef.current = { ok: true, value: 'ctx result' }
		render(
			<ExpressionValuePreview
				expression="$(this:value)"
				controlId={null}
				fieldDefinition={textField()}
				contextResolution={{ type: 'customVariable', nameValue: exprVal('myVar') }}
			/>
		)

		expect(optionsSpy).toHaveBeenCalledWith(
			expect.objectContaining({ contextResolution: expect.objectContaining({ type: 'customVariable' }) }),
			expect.anything()
		)
	})

	it('does not subscribe when contextResolution has no nameValue', async () => {
		const { trpc } = await import('~/Resources/TRPC.js')
		const optionsSpy = vi.mocked(trpc.preview.expressionStream.watchExpression.subscriptionOptions)
		optionsSpy.mockClear()

		render(
			<ExpressionValuePreview
				expression="$(this:value)"
				controlId={null}
				fieldDefinition={textField()}
				contextResolution={{ type: 'customVariable', nameValue: undefined }}
			/>
		)

		expect(optionsSpy).toHaveBeenCalledWith(
			expect.objectContaining({ contextResolution: undefined }),
			expect.anything()
		)
	})
})
