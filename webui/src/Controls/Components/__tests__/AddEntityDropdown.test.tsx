import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { prepare as fuzzyPrepare } from 'fuzzysort'
import { observable } from 'mobx'
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest'
import { EntityModelType } from '@companion-app/shared/Model/EntityModel.js'
import { MenuPortalContext } from '~/Components/MenuPortalContext.js'
import type { AddEntityGroup, AddEntityOption } from '~/Stores/EntityDefinitionsStore.js'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import { AddEntityDropdown } from '../AddEntityDropdown.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function option(id: string, label: string): AddEntityOption {
	return { id, label, sortKey: label, fuzzy: fuzzyPrepare(label) }
}

// The same entity appears in several groups, as it does in the real store
const BASE_GROUPS: AddEntityGroup[] = [
	{
		id: '__all__',
		label: '',
		showWhenUnfiltered: false,
		items: [option('internal:alpha', 'Internal: Alpha'), option('conn1:beta', 'Conn One: Beta')],
	},
	{ id: '__common__', label: 'Common', showWhenUnfiltered: true, items: [option('internal:alpha', 'Alpha')] },
]

function renderDropdown() {
	const onSelect = vi.fn()
	const trackId = vi.fn()
	// Deep partial of the root store - the dropdown only reaches for these
	const rootStore: any = {
		entityDefinitions: {
			getEntityDefinitionsStore: () => ({
				buildBaseOptions: () => BASE_GROUPS,
				connections: new Map([['conn1', new Map([['beta', { label: 'Beta' }]])]]),
			}),
			getRecentlyUsedEntityDefinitionsStore: () => ({ recentIds: observable.array(['conn1:beta']), trackId }),
		},
		connections: { getLabel: (id: string) => (id === 'conn1' ? 'Conn One' : undefined) },
	}

	const user = userEvent.setup()
	const utils = render(
		<RootAppStoreContext.Provider value={rootStore}>
			<MenuPortalContext.Provider value={document.body}>
				<AddEntityDropdown
					onSelect={onSelect}
					entityType={EntityModelType.Action}
					entityTypeLabel="action"
					feedbackListType={null}
					disabled={false}
				/>
			</MenuPortalContext.Provider>
		</RootAppStoreContext.Provider>
	)
	return { ...utils, user, onSelect, trackId, input: utils.getByRole('combobox') }
}

// An entity appears in multiple groups, so the item ids must be scoped to avoid base-ui reporting duplicate values.
// base-ui only reports each one once, so check in every test rather than relying on one test to trigger it
let consoleError: MockInstance<typeof console.error>
beforeEach(() => {
	consoleError = vi.spyOn(console, 'error')
})
afterEach(() => {
	expect(consoleError).not.toHaveBeenCalled()
	vi.restoreAllMocks()
})

// ---------------------------------------------------------------------------
// Selection
// ---------------------------------------------------------------------------

describe('AddEntityDropdown — selection', () => {
	it('shows the common and recently used groups when unfiltered', async () => {
		const { user, input } = renderDropdown()
		await user.click(input)
		const list = screen.getByRole('listbox')
		expect(within(list).getByText('Common')).toBeInTheDocument()
		expect(within(list).getByText('Recently Used')).toBeInTheDocument()
		expect(
			within(list)
				.getAllByRole('option')
				.map((o) => o.textContent)
		).toEqual(['Alpha', 'Conn One: Beta'])
	})

	it('selects an entity from the common group', async () => {
		const { user, input, onSelect, trackId } = renderDropdown()
		await user.click(input)
		await user.click(within(screen.getByRole('listbox')).getByRole('option', { name: 'Alpha' }))
		expect(onSelect).toHaveBeenCalledWith('internal', 'alpha')
		expect(trackId).toHaveBeenCalledWith('internal:alpha')
	})

	it('selects an entity from the recently used group', async () => {
		const { user, input, onSelect, trackId } = renderDropdown()
		await user.click(input)
		await user.click(within(screen.getByRole('listbox')).getByRole('option', { name: 'Conn One: Beta' }))
		expect(onSelect).toHaveBeenCalledWith('conn1', 'beta')
		expect(trackId).toHaveBeenCalledWith('conn1:beta')
	})

	it('selects an entity found by searching', async () => {
		const { user, input, onSelect } = renderDropdown()
		await user.click(input)
		await user.type(input, 'beta')
		await user.click(within(screen.getByRole('listbox')).getByRole('option', { name: 'Conn One: Beta' }))
		expect(onSelect).toHaveBeenCalledWith('conn1', 'beta')
	})
})
