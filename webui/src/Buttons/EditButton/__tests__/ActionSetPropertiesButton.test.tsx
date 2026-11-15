import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { createRef } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { ActionSetPropertiesButton } from '../ActionSetPropertiesButton.js'
import {
	EditDurationGroupPropertiesModal,
	type EditDurationGroupPropertiesModalRef,
} from '../EditDurationGroupPropertiesModal.js'

describe('ActionSetPropertiesButton', () => {
	it('shows the surface cue in the properties modal and reports a change on save', () => {
		const setControlEvents = vi.fn()
		render(<ActionSetPropertiesButton controlEvents setControlEvents={setControlEvents} />)

		expect(screen.queryByRole('checkbox', { name: 'Surface cue' })).toBeNull()
		fireEvent.click(screen.getByTitle('Configure'))

		const dialog = screen.getByRole('dialog')
		const checkbox = within(dialog).getByRole('checkbox', { name: 'Surface cue' })
		expect(checkbox).toBeChecked()

		fireEvent.click(checkbox)
		fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }))
		expect(setControlEvents).toHaveBeenCalledWith(false)
	})

	it('reports nothing when saved unchanged', () => {
		const setControlEvents = vi.fn()
		render(<ActionSetPropertiesButton controlEvents={false} setControlEvents={setControlEvents} />)

		fireEvent.click(screen.getByTitle('Configure'))
		const dialog = screen.getByRole('dialog')
		expect(within(dialog).getByRole('checkbox', { name: 'Surface cue' })).not.toBeChecked()

		fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }))
		expect(setControlEvents).not.toHaveBeenCalled()
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
