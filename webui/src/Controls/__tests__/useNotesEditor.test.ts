import { act, renderHook } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'
import { useNotesEditor } from '../useNotesEditor.js'

describe('useNotesEditor', () => {
	test('a note of only whitespace counts as no note', () => {
		const setNotes = vi.fn()
		expect(renderHook(() => useNotesEditor('a', undefined, setNotes)).result.current.hasNote).toBe(false)
		expect(renderHook(() => useNotesEditor('a', '  \n ', setNotes)).result.current.hasNote).toBe(false)
		expect(renderHook(() => useNotesEditor('a', 'Cue lights', setNotes)).result.current.hasNote).toBe(true)
	})

	test('starts and stops editing', () => {
		const { result } = renderHook(() => useNotesEditor('a', undefined, vi.fn()))
		expect(result.current.isEditing).toBe(false)

		act(() => result.current.startEditing())
		expect(result.current.isEditing).toBe(true)

		act(() => result.current.stopEditing())
		expect(result.current.isEditing).toBe(false)
	})

	test('switching to something else closes the editor', () => {
		const { result, rerender } = renderHook(({ ownerId }) => useNotesEditor(ownerId, undefined, vi.fn()), {
			initialProps: { ownerId: 'a' },
		})

		act(() => result.current.startEditing())
		expect(result.current.isEditing).toBe(true)

		rerender({ ownerId: 'b' })
		expect(result.current.isEditing).toBe(false)
	})

	test('saves through the given setter', () => {
		const setNotes = vi.fn()
		const { result } = renderHook(() => useNotesEditor('a', undefined, setNotes))

		result.current.setNotes('New note')
		expect(setNotes).toHaveBeenCalledWith('New note')
	})
})
