import { fireEvent, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useActivateOnKey } from '../useActivateOnKey.js'

function setup() {
	const onActivate = vi.fn()
	const { result } = renderHook(() => useActivateOnKey(onActivate))
	const row = document.createElement('div')
	const inner = document.createElement('input')
	row.appendChild(inner)
	row.addEventListener('keydown', (e) => result.current(e as unknown as React.KeyboardEvent))
	return { onActivate, row, inner }
}

describe('useActivateOnKey', () => {
	it('activates on Enter and Space', () => {
		const { onActivate, row } = setup()
		fireEvent.keyDown(row, { key: 'Enter' })
		fireEvent.keyDown(row, { key: ' ' })
		expect(onActivate).toHaveBeenCalledTimes(2)
	})

	it('ignores other keys', () => {
		const { onActivate, row } = setup()
		fireEvent.keyDown(row, { key: 'a' })
		expect(onActivate).not.toHaveBeenCalled()
	})

	it('leaves keys pressed in a control inside it to that control', () => {
		const { onActivate, inner } = setup()
		fireEvent.keyDown(inner, { key: 'Enter' })
		expect(onActivate).not.toHaveBeenCalled()
	})
})
