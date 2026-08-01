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
		expect(container.firstChild).toHaveClass('col-sm-4')
		// unlike Grid.Col, FormLabel must NOT fall back to a bare `col`
		expect(container.firstChild).not.toHaveClass('col')
	})

	it('supports the offset object form', () => {
		const { container } = render(
			<FormLabel htmlFor="x" sm={{ span: 4, offset: 1 }} column="sm">
				Name
			</FormLabel>
		)
		expect(container.firstChild).toHaveClass('col-sm-4', 'offset-sm-1', 'col-form-label', 'col-form-label-sm')
	})

	it('does not emit a bare col when no breakpoint props are given', () => {
		const { container } = render(<FormLabel htmlFor="x">Name</FormLabel>)
		expect(container.firstChild).not.toHaveClass('col')
	})

	it('appends passthrough className', () => {
		const { container } = render(
			<FormLabel htmlFor="x" sm={4} column="sm" className="mb-2">
				Name
			</FormLabel>
		)
		expect(container.firstChild).toHaveClass('form-label', 'col-sm-4', 'col-form-label', 'col-form-label-sm', 'mb-2')
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
