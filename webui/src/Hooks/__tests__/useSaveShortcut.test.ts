import { renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useSaveShortcut } from '../useSaveShortcut.js'

function pressKey(init: KeyboardEventInit): KeyboardEvent {
	const event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init })
	document.body.dispatchEvent(event)
	return event
}

describe('useSaveShortcut', () => {
	it('calls onSave on Ctrl+S and stops the browser save', () => {
		const onSave = vi.fn()
		renderHook(() => useSaveShortcut(onSave))

		const event = pressKey({ key: 's', ctrlKey: true })
		expect(onSave).toHaveBeenCalledTimes(1)
		expect(event.defaultPrevented).toBe(true)
	})

	it('calls onSave on Cmd+S', () => {
		const onSave = vi.fn()
		renderHook(() => useSaveShortcut(onSave))

		pressKey({ key: 's', metaKey: true })
		expect(onSave).toHaveBeenCalledTimes(1)
	})

	it('ignores a plain S', () => {
		const onSave = vi.fn()
		renderHook(() => useSaveShortcut(onSave))

		const event = pressKey({ key: 's' })
		expect(onSave).not.toHaveBeenCalled()
		expect(event.defaultPrevented).toBe(false)
	})

	it('stops listening on unmount', () => {
		const onSave = vi.fn()
		const { unmount } = renderHook(() => useSaveShortcut(onSave))
		unmount()

		pressKey({ key: 's', ctrlKey: true })
		expect(onSave).not.toHaveBeenCalled()
	})
})
