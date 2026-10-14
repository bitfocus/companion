import { faCircleInfo } from '@fortawesome/free-solid-svg-icons'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Note, NoteDetail } from '../Note'

describe('Note', () => {
	it('announces danger notes as alerts and warnings as status', () => {
		const { rerender } = render(
			<Note tone="danger" icon={faCircleInfo} actions={null}>
				Broken
			</Note>
		)
		expect(screen.getByRole('alert')).toHaveTextContent('Broken')

		rerender(
			<Note tone="warning" icon={faCircleInfo} actions={null}>
				Careful
			</Note>
		)
		expect(screen.getByRole('status')).toHaveTextContent('Careful')
	})

	it('does not announce neutral notes', () => {
		render(
			<Note tone="neutral" icon={faCircleInfo} actions={null}>
				For information
			</Note>
		)
		expect(screen.queryByRole('alert')).toBeNull()
		expect(screen.queryByRole('status')).toBeNull()
	})

	it('renders actions only when given', () => {
		const { container, rerender } = render(
			<Note tone="neutral" icon={faCircleInfo} actions={null}>
				Message
			</Note>
		)
		expect(container.querySelector('.inline-note-actions')).toBeNull()

		rerender(
			<Note tone="neutral" icon={faCircleInfo} actions={<button type="button">Fix</button>}>
				Message
			</Note>
		)
		expect(screen.getByRole('button', { name: 'Fix' }).closest('.inline-note-actions')).not.toBeNull()
	})

	it('shows detail text inside the message', () => {
		render(
			<Note tone="danger" icon={faCircleInfo} actions={null}>
				Failed
				<NoteDetail>stack trace</NoteDetail>
			</Note>
		)
		expect(screen.getByText('stack trace').closest('.inline-note-body')).not.toBeNull()
	})
})
