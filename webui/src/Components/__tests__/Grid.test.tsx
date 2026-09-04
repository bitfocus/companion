import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Grid } from '../Grid'

// ─── Grid.Row ─────────────────────────────────────────────────────────────────

describe('Grid.Row', () => {
	it('renders a div with class row', () => {
		const { container } = render(<Grid.Row />)
		const el = container.firstChild as HTMLElement
		expect(el.tagName).toBe('DIV')
		expect(el).toHaveClass('row')
	})

	it('merges additional className', () => {
		const { container } = render(<Grid.Row className="my-class" />)
		const el = container.firstChild as HTMLElement
		expect(el).toHaveClass('row', 'my-class')
	})

	it('has no grid-cols class by default (the 12 columns come from .row)', () => {
		const { container } = render(<Grid.Row />)
		expect((container.firstChild as HTMLElement).className).not.toMatch(/grid-cols-/)
	})

	it('columns={4} → grid-cols-4', () => {
		const { container } = render(<Grid.Row columns={4} />)
		expect(container.firstChild).toHaveClass('row', 'grid-cols-4')
	})

	it('clamps an out-of-range column count', () => {
		const { container } = render(<Grid.Row columns={99} />)
		expect(container.firstChild).toHaveClass('grid-cols-12')
	})

	it('passes through HTML attributes', () => {
		const { container } = render(<Grid.Row data-testid="my-row" />)
		const el = container.firstChild as HTMLElement
		expect(el.getAttribute('data-testid')).toBe('my-row')
	})

	it('renders children', () => {
		const { getByText } = render(<Grid.Row>Hello</Grid.Row>)
		expect(getByText('Hello')).toBeInTheDocument()
	})
})

// ─── Grid.Col ─────────────────────────────────────────────────────────────────

describe('Grid.Col', () => {
	it('renders a div with no span class when no breakpoint props given', () => {
		// `.row > *` fills the row in CSS, so a column with no span needs no class of its own.
		const { container } = render(<Grid.Col />)
		const el = container.firstChild as HTMLElement
		expect(el.tagName).toBe('DIV')
		expect(el.className).toBe('')
	})

	it('xs={6} → col-span-6 (no variant prefix for xs)', () => {
		const { container } = render(<Grid.Col xs={6} />)
		expect(container.firstChild).toHaveClass('col-span-6')
	})

	it('sm={8} → sm:col-span-8', () => {
		const { container } = render(<Grid.Col sm={8} />)
		expect(container.firstChild).toHaveClass('sm:col-span-8')
	})

	it('md={6} lg={4} → md:col-span-6 lg:col-span-4', () => {
		const { container } = render(<Grid.Col md={6} lg={4} />)
		expect(container.firstChild).toHaveClass('md:col-span-6', 'lg:col-span-4')
	})

	it('multiple breakpoints produce correct classes', () => {
		const { container } = render(<Grid.Col xs={12} sm={8} md={6} xxl={4} />)
		expect(container.firstChild).toHaveClass('col-span-12', 'sm:col-span-8', 'md:col-span-6', '2xl:col-span-4')
	})

	it('xxl maps to the 2xl variant', () => {
		const { container } = render(<Grid.Col xxl={2} />)
		expect(container.firstChild).toHaveClass('2xl:col-span-2')
	})

	it('sm={{ span: 8, offset: 4 }} → sm:col-span-8 sm:col-start-5', () => {
		const { container } = render(<Grid.Col sm={{ span: 8, offset: 4 }} />)
		expect(container.firstChild).toHaveClass('sm:col-span-8', 'sm:col-start-5')
	})

	it('xs={{ span: 10, offset: 1 }} → col-span-10 col-start-2', () => {
		const { container } = render(<Grid.Col xs={{ span: 10, offset: 1 }} />)
		expect(container.firstChild).toHaveClass('col-span-10', 'col-start-2')
	})

	it('an offset of 0 puts the column back into the normal flow', () => {
		const { container } = render(<Grid.Col sm={{ span: 6, offset: 0 }} />)
		expect(container.firstChild).toHaveClass('sm:col-span-6', 'sm:col-start-auto')
	})

	it('an offset without a span only places the column', () => {
		const { container } = render(<Grid.Col sm={{ offset: 2 }} />)
		const el = container.firstChild as HTMLElement
		expect(el).toHaveClass('sm:col-start-3')
		expect(el.className).not.toMatch(/col-span-/)
	})

	it('clamps out-of-range spans', () => {
		const { container } = render(<Grid.Col xs={0} sm={99} />)
		expect(container.firstChild).toHaveClass('col-span-1', 'sm:col-span-12')
	})

	it('merges additional className', () => {
		const { container } = render(<Grid.Col xs={6} className="my-class" />)
		expect(container.firstChild).toHaveClass('col-span-6', 'my-class')
	})

	it('passes through HTML attributes', () => {
		const { container } = render(<Grid.Col data-testid="my-col" />)
		const el = container.firstChild as HTMLElement
		expect(el.getAttribute('data-testid')).toBe('my-col')
	})
})

// ─── Grid.Container ───────────────────────────────────────────────────────────

describe('Grid.Container', () => {
	it('renders a div with class page-container', () => {
		const { container } = render(<Grid.Container />)
		const el = container.firstChild as HTMLElement
		expect(el.tagName).toBe('DIV')
		expect(el).toHaveClass('page-container')
	})

	it('merges additional className', () => {
		const { container } = render(<Grid.Container className="my-class" />)
		expect(container.firstChild).toHaveClass('page-container', 'my-class')
	})

	it('passes through HTML attributes', () => {
		const { container } = render(<Grid.Container data-testid="my-container" />)
		const el = container.firstChild as HTMLElement
		expect(el.getAttribute('data-testid')).toBe('my-container')
	})

	it('renders children', () => {
		const { getByText } = render(<Grid.Container>Content</Grid.Container>)
		expect(getByText('Content')).toBeInTheDocument()
	})
})
