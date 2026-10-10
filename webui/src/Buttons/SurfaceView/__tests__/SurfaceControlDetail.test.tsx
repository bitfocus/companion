import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { SurfaceControlDetail } from '../SurfaceControlDetail.js'

describe('SurfaceControlDetail', () => {
	it('draws nothing over a key or a slice of a screen', () => {
		expect(render(<SurfaceControlDetail kind="button" turn={0} />).container).toBeEmptyDOMElement()
		expect(render(<SurfaceControlDetail kind="lcd-segment" turn={0} />).container).toBeEmptyDOMElement()
	})

	it('turns the detail of a knob as far as it has been turned', () => {
		const { container } = render(<SurfaceControlDetail kind="encoder" turn={45} />)
		const detail = container.querySelector('.surface-control-detail-encoder') as HTMLElement

		expect(detail.style.rotate).toBe('45deg')
	})

	it('turns it back the other way for a turn leftward', () => {
		const { container } = render(<SurfaceControlDetail kind="jog" turn={-30} />)

		expect((container.firstElementChild as HTMLElement).style.rotate).toBe('-30deg')
	})
})
