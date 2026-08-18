import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { FormLabel } from '../Form'

// ─── FormLabel ────────────────────────────────────────────────────────────────

describe('FormLabel', () => {
	it('renders a label with the base form-label class', () => {
		const { container } = render(<FormLabel htmlFor="x">Name</FormLabel>)
		const el = container.firstChild as HTMLElement
		expect(el.tagName).toBe('LABEL')
		expect(el).toHaveClass('form-label')
	})

	it('column adds col-form-label (no size modifier)', () => {
		const { container } = render(
			<FormLabel htmlFor="x" column>
				Name
			</FormLabel>
		)
		expect(container.firstChild).toHaveClass('form-label', 'col-form-label')
		expect(container.firstChild).not.toHaveClass('col-form-label-sm', 'col-form-label-lg')
	})

	it("column='sm' adds col-form-label col-form-label-sm", () => {
		const { container } = render(
			<FormLabel htmlFor="x" column="sm">
				Name
			</FormLabel>
		)
		expect(container.firstChild).toHaveClass('col-form-label', 'col-form-label-sm')
	})

	it("column='lg' adds col-form-label col-form-label-lg", () => {
		const { container } = render(
			<FormLabel htmlFor="x" column="lg">
				Name
			</FormLabel>
		)
		expect(container.firstChild).toHaveClass('col-form-label', 'col-form-label-lg')
	})

	it('grid breakpoint props generate grid classes', () => {
		const { container } = render(
			<FormLabel htmlFor="x" sm={4}>
				Name
			</FormLabel>
		)
		expect(container.firstChild).toHaveClass('sm:col-span-4')
	})

	it('supports the offset object form', () => {
		const { container } = render(
			<FormLabel htmlFor="x" sm={{ span: 4, offset: 1 }} column="sm">
				Name
			</FormLabel>
		)
		expect(container.firstChild).toHaveClass('sm:col-span-4', 'sm:col-start-2', 'col-form-label', 'col-form-label-sm')
	})

	it('emits no span class when no breakpoint props are given', () => {
		const { container } = render(<FormLabel htmlFor="x">Name</FormLabel>)
		expect((container.firstChild as HTMLElement).className).not.toMatch(/col-span-/)
	})

	it('appends passthrough className', () => {
		const { container } = render(
			<FormLabel htmlFor="x" sm={4} column="sm" className="mb-2">
				Name
			</FormLabel>
		)
		expect(container.firstChild).toHaveClass(
			'form-label',
			'sm:col-span-4',
			'col-form-label',
			'col-form-label-sm',
			'mb-2'
		)
	})

	it('passes through htmlFor and other label attributes', () => {
		const { container } = render(
			<FormLabel htmlFor="my-input" title="hint">
				Name
			</FormLabel>
		)
		const el = container.firstChild as HTMLElement
		expect(el.getAttribute('for')).toBe('my-input')
		expect(el.getAttribute('title')).toBe('hint')
	})
})
