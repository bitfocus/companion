import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ProgressBar } from '../ProgressBar'

describe('ProgressBar rendering', () => {
	it('renders without crashing', () => {
		const { container } = render(<ProgressBar />)
		expect(container.firstChild).toBeInTheDocument()
	})

	it('applies progress2 class', () => {
		const { container } = render(<ProgressBar />)
		expect(container.firstChild).toHaveClass('progress2')
	})

	it('applies additional className', () => {
		const { container } = render(<ProgressBar className="mt-4" />)
		expect(container.firstChild).toHaveClass('progress2', 'mt-4')
	})

	it('defaults to 0 when value is undefined', () => {
		const { container } = render(<ProgressBar />)
		const indicator = container.querySelector('.progress2-bar')
		expect(indicator).toHaveStyle({ width: '0%' })
	})

	it('sets indicator width from value', () => {
		const { container } = render(<ProgressBar value={50} />)
		const indicator = container.querySelector('.progress2-bar')
		expect(indicator).toHaveStyle({ width: '50%' })
	})

	it('handles value 0', () => {
		const { container } = render(<ProgressBar value={0} />)
		const indicator = container.querySelector('.progress2-bar')
		expect(indicator).toHaveStyle({ width: '0%' })
	})

	it('handles value 100', () => {
		const { container } = render(<ProgressBar value={100} />)
		const indicator = container.querySelector('.progress2-bar')
		expect(indicator).toHaveStyle({ width: '100%' })
	})

	it('forwards ref to root element', () => {
		let ref: HTMLDivElement | null = null
		render(<ProgressBar ref={(el) => (ref = el)} value={25} />)
		expect(ref).toBeInstanceOf(HTMLElement)
	})
})
