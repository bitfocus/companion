import { fireEvent, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useEscapeToClose } from '../useEscapeToClose.js'

describe('useEscapeToClose', () => {
	afterEach(() => {
		document.body.innerHTML = ''
	})

	it('calls onClose on Escape when enabled', () => {
		const onClose = vi.fn()
		renderHook(() => useEscapeToClose(true, onClose))

		fireEvent.keyDown(document.body, { key: 'Escape' })
		expect(onClose).toHaveBeenCalledTimes(1)
	})

	it('ignores other keys', () => {
		const onClose = vi.fn()
		renderHook(() => useEscapeToClose(true, onClose))

		fireEvent.keyDown(document.body, { key: 'Enter' })
		expect(onClose).not.toHaveBeenCalled()
	})

	it('does nothing when disabled', () => {
		const onClose = vi.fn()
		renderHook(() => useEscapeToClose(false, onClose))

		fireEvent.keyDown(document.body, { key: 'Escape' })
		expect(onClose).not.toHaveBeenCalled()
	})

	it('leaves Escape to a focused input', () => {
		const onClose = vi.fn()
		renderHook(() => useEscapeToClose(true, onClose))

		const input = document.createElement('input')
		document.body.appendChild(input)
		fireEvent.keyDown(input, { key: 'Escape' })
		expect(onClose).not.toHaveBeenCalled()
	})

	it('leaves Escape to an open dialog', () => {
		const onClose = vi.fn()
		renderHook(() => useEscapeToClose(true, onClose))

		const dialog = document.createElement('div')
		dialog.setAttribute('role', 'dialog')
		document.body.appendChild(dialog)
		fireEvent.keyDown(document.body, { key: 'Escape' })
		expect(onClose).not.toHaveBeenCalled()
	})

	it('ignores an already handled Escape', () => {
		const onClose = vi.fn()
		renderHook(() => useEscapeToClose(true, onClose))

		const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
		event.preventDefault()
		document.body.dispatchEvent(event)
		expect(onClose).not.toHaveBeenCalled()
	})

	it('stops listening on unmount', () => {
		const onClose = vi.fn()
		const { unmount } = renderHook(() => useEscapeToClose(true, onClose))
		unmount()

		fireEvent.keyDown(document.body, { key: 'Escape' })
		expect(onClose).not.toHaveBeenCalled()
	})
})
