import { act, fireEvent, render, screen } from '@testing-library/react'
import { createRef } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { ActionSetControlEventsCheckbox } from '../ActionSetControlEventsCheckbox.js'
import {
	EditDurationGroupPropertiesModal,
	type EditDurationGroupPropertiesModalRef,
} from '../EditDurationGroupPropertiesModal.js'

describe('ActionSetControlEventsCheckbox', () => {
	it('renders an accessible checked preference and reports changes', () => {
		const setEnabled = vi.fn()
		render(<ActionSetControlEventsCheckbox enabled setEnabled={setEnabled} />)

		const checkbox = screen.getByRole('checkbox', { name: 'Surface cue' })
		expect(checkbox).toBeChecked()

		fireEvent.click(checkbox)
		expect(setEnabled).toHaveBeenCalledWith(false)
	})

	it('renders an unchecked preference', () => {
		render(<ActionSetControlEventsCheckbox enabled={false} setEnabled={vi.fn()} />)

		expect(screen.getByRole('checkbox', { name: 'Surface cue' })).not.toBeChecked()
	})
})

describe('EditDurationGroupPropertiesModal surface cue preference', () => {
	it('renders the numeric group preference and returns its updated value', () => {
		const ref = createRef<EditDurationGroupPropertiesModalRef>()
		const complete = vi.fn()
		render(<EditDurationGroupPropertiesModal ref={ref} />)

		act(() => ref.current?.show(1000, false, true, complete))
		const checkbox = screen.getByRole('checkbox', { name: 'Surface cue' })
		expect(checkbox).toBeChecked()

		fireEvent.click(checkbox)
		fireEvent.click(screen.getByRole('button', { name: 'Save' }))
		expect(complete).toHaveBeenCalledWith(1000, false, false)
	})
})
