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
	it('renders a div with class col when no breakpoint props given', () => {
		const { container } = render(<Grid.Col />)
		const el = container.firstChild as HTMLElement
		expect(el.tagName).toBe('DIV')
		expect(el).toHaveClass('col')
	})

	it('xs={6} → col-6', () => {
		const { container } = render(<Grid.Col xs={6} />)
		expect(container.firstChild).toHaveClass('col-6')
		expect(container.firstChild).not.toHaveClass('col')
	})

	it('sm={8} → col-sm-8', () => {
		const { container } = render(<Grid.Col sm={8} />)
		expect(container.firstChild).toHaveClass('col-sm-8')
	})

	it('md={6} lg={4} → col-md-6 col-lg-4', () => {
		const { container } = render(<Grid.Col md={6} lg={4} />)
		expect(container.firstChild).toHaveClass('col-md-6', 'col-lg-4')
	})

	it('multiple breakpoints produce correct classes', () => {
		const { container } = render(<Grid.Col xs={12} sm={8} md={6} xxl={4} />)
		expect(container.firstChild).toHaveClass('col-12', 'col-sm-8', 'col-md-6', 'col-xxl-4')
	})

	it('sm={{ span: 8, offset: 4 }} → col-sm-8 offset-sm-4', () => {
		const { container } = render(<Grid.Col sm={{ span: 8, offset: 4 }} />)
		expect(container.firstChild).toHaveClass('col-sm-8', 'offset-sm-4')
	})

	it('xs={{ span: 10, offset: 1 }} → col-10 offset-1 (no infix for xs)', () => {
		const { container } = render(<Grid.Col xs={{ span: 10, offset: 1 }} />)
		expect(container.firstChild).toHaveClass('col-10', 'offset-1')
	})

	it('xs={true} → col', () => {
		const { container } = render(<Grid.Col xs={true} />)
		expect(container.firstChild).toHaveClass('col')
	})

	it('sm={true} → col-sm', () => {
		const { container } = render(<Grid.Col sm={true} />)
		expect(container.firstChild).toHaveClass('col-sm')
	})

	it("xs='auto' → col-auto", () => {
		const { container } = render(<Grid.Col xs="auto" />)
		expect(container.firstChild).toHaveClass('col-auto')
	})

	it("sm='auto' → col-sm-auto", () => {
		const { container } = render(<Grid.Col sm="auto" />)
		expect(container.firstChild).toHaveClass('col-sm-auto')
	})

	it('merges additional className', () => {
		const { container } = render(<Grid.Col xs={6} className="my-class" />)
		expect(container.firstChild).toHaveClass('col-6', 'my-class')
	})

	it('passes through HTML attributes', () => {
		const { container } = render(<Grid.Col data-testid="my-col" />)
		const el = container.firstChild as HTMLElement
		expect(el.getAttribute('data-testid')).toBe('my-col')
	})
})

// ─── Grid.Container ───────────────────────────────────────────────────────────

describe('Grid.Container', () => {
	it('renders a div with class container by default', () => {
		const { container } = render(<Grid.Container />)
		const el = container.firstChild as HTMLElement
		expect(el.tagName).toBe('DIV')
		expect(el).toHaveClass('container')
		expect(el).not.toHaveClass('container-fluid')
	})

	it('fluid renders container-fluid', () => {
		const { container } = render(<Grid.Container fluid />)
		expect(container.firstChild).toHaveClass('container-fluid')
		expect(container.firstChild).not.toHaveClass('container')
	})

	it('merges additional className', () => {
		const { container } = render(<Grid.Container className="my-class" />)
		expect(container.firstChild).toHaveClass('container', 'my-class')
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
