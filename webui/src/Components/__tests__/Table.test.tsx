import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Table } from '../Table'

describe('Table', () => {
	it('renders a table with the base class and responsive-sm by default', () => {
		const { container } = render(<Table />)
		const el = container.firstChild as HTMLElement
		expect(el.tagName).toBe('TABLE')
		expect(el).toHaveClass('table', 'table-responsive-sm')
	})

	it('responsive={false} omits table-responsive-sm', () => {
		const { container } = render(<Table responsive={false} />)
		expect(container.firstChild).toHaveClass('table')
		expect(container.firstChild).not.toHaveClass('table-responsive-sm')
	})

	it("size='sm' adds table-sm", () => {
		const { container } = render(<Table size="sm" />)
		expect(container.firstChild).toHaveClass('table', 'table-sm')
	})

	it('striped adds table-striped', () => {
		const { container } = render(<Table striped />)
		expect(container.firstChild).toHaveClass('table', 'table-striped')
	})

	it('composes props with a passthrough className', () => {
		const { container } = render(<Table size="sm" striped responsive={false} className="table-settings cui-mb-1" />)
		const el = container.firstChild as HTMLElement
		expect(el).toHaveClass('table', 'table-sm', 'table-striped', 'table-settings', 'cui-mb-1')
		expect(el).not.toHaveClass('table-responsive-sm')
	})

	it('passes through HTML attributes and children', () => {
		const { container, getByText } = render(
			<Table data-testid="my-table">
				<tbody>
					<tr>
						<td>cell</td>
					</tr>
				</tbody>
			</Table>
		)
		const el = container.firstChild as HTMLElement
		expect(el.getAttribute('data-testid')).toBe('my-table')
		expect(getByText('cell')).toBeInTheDocument()
	})
})
