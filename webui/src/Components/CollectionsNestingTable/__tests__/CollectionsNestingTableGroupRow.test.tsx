import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { PropsWithChildren } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { CollectionsNestingTableCollectionRow } from '../CollectionsNestingTableGroupRow.js'

vi.mock('../CollectionsNestingTableRowWrappers.js', () => ({
	CollectionsNestingTableCollectionRowWrapper: ({ children }: PropsWithChildren) => <div>{children}</div>,
}))

function renderCollection() {
	const renameCollection = vi.fn()
	const toggleExpanded = vi.fn()
	render(
		<CollectionsNestingTableCollectionRow
			collection={{ id: 'collection', label: 'Original', children: [] }}
			parentId={null}
			index={0}
			isCollapsed={false}
			toggleExpanded={toggleExpanded}
			collectionsApi={{
				renameCollection,
				deleteCollection: vi.fn(),
				moveCollection: vi.fn(),
				moveItemToCollection: vi.fn(),
			}}
			nestingLevel={0}
		/>
	)
	return { renameCollection, toggleExpanded }
}

describe('Collection rename', () => {
	it('finishes on the first check click even when the pointer is held down', async () => {
		const user = userEvent.setup()
		const { renameCollection, toggleExpanded } = renderCollection()
		await user.click(screen.getByRole('button', { name: 'Rename collection' }))
		await user.type(screen.getByRole('textbox'), ' updated')
		expect(renameCollection).toHaveBeenLastCalledWith('collection', 'Original updated')

		const check = screen.getByRole('button', { name: 'Finish renaming collection' })
		await user.pointer({ target: check, keys: '[MouseLeft>]' })
		await new Promise((resolve) => setTimeout(resolve, 150))
		expect(screen.getByRole('textbox')).toHaveFocus()
		await user.pointer({ target: check, keys: '[/MouseLeft]' })

		expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
		expect(screen.getByRole('button', { name: 'Rename collection' })).toBeInTheDocument()
		expect(toggleExpanded).not.toHaveBeenCalled()
	})

	it('finishes immediately on blur and can reopen without a pending timer closing it', async () => {
		const user = userEvent.setup()
		renderCollection()
		await user.click(screen.getByRole('button', { name: 'Rename collection' }))
		await user.tab()
		expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
		await user.click(screen.getByRole('button', { name: 'Rename collection' }))
		await new Promise((resolve) => setTimeout(resolve, 150))
		expect(screen.getByRole('textbox')).toHaveFocus()
		await user.keyboard('{Enter}')
		expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
	})
})
