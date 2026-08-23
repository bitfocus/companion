import { act, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { ButtonGridSelectionActions } from '../ButtonGridSelectionActions.js'
import { at, makeGridView, renderInGridView } from './gridViewTestHelpers.js'

function setup(selection = [at(1, 1), at(1, 2)]) {
	const view = makeGridView()
	act(() => view.store.setSelection(selection))
	renderInGridView(<ButtonGridSelectionActions />, view)

	return { ...view, user: userEvent.setup() }
}

/**
 * The actions on offer for a selection, shared by the bar above the grid and the selection panel.
 * Each one hands the selection to a tool or an action rather than doing anything itself.
 */
describe('the selection actions', () => {
	it.each([
		['Copy', 'copy'],
		['Move', 'move'],
		['Swap', 'swap'],
	] as const)('%s arms the %s tool, which takes the selection with it', async (label, toolId) => {
		const { store, actions, user } = setup()

		await user.click(screen.getByRole('button', { name: label }))

		expect(store.activeToolId).toBe(toolId)
		// Held by the tool now, rather than selected as well
		expect([...store.transferSourceKeys].sort()).toEqual(['1/1/1', '1/1/2'])
		expect(store.selectionCount).toBe(0)
		expect(actions.transfer).not.toHaveBeenCalled()
	})

	it('Delete asks about the selection rather than clearing it outright', async () => {
		const { actions, user } = setup()

		await user.click(screen.getByRole('button', { name: 'Delete' }))

		expect(actions.clearButtons).toHaveBeenCalledWith([at(1, 1), at(1, 2)])
	})

	it('Deselect drops the selection without arming anything', async () => {
		const { store, user } = setup()

		await user.click(screen.getByRole('button', { name: 'Deselect' }))

		expect(store.selectionCount).toBe(0)
		expect(store.activeToolId).toBe('select')
	})
})
