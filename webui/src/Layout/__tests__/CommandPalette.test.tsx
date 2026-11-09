import { fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { CommandPalette } from '../CommandPalette.js'
import { commandPaletteOpen } from '../CommandPaletteState.js'

// Only the closed palette is rendered here: opening it builds the catalog from the whole app store
describe('CommandPalette "/" shortcut', () => {
	afterEach(() => {
		commandPaletteOpen.set(false)
		document.body.innerHTML = ''
	})

	function typeSlashIn(element: HTMLElement): boolean {
		document.body.appendChild(element)
		render(<CommandPalette />)
		return fireEvent.keyDown(element, { key: '/' })
	}

	it('leaves "/" to a text field', () => {
		const notPrevented = typeSlashIn(document.createElement('input'))

		expect(notPrevented).toBe(true)
		expect(commandPaletteOpen.get()).toBe(false)
	})

	it('leaves "/" to the expression editor', () => {
		const editor = document.createElement('div')
		editor.classList.add('native-edit-context')
		editor.tabIndex = 0

		const notPrevented = typeSlashIn(editor)

		expect(notPrevented).toBe(true)
		expect(commandPaletteOpen.get()).toBe(false)
	})
})
