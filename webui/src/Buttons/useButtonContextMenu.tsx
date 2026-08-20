import { nanoid } from 'nanoid'
import { useCallback, useContext, useMemo, useState, useSyncExternalStore } from 'react'
import type { ControlLocation } from '@companion-app/shared/Model/Common.js'
import type { MenuItemProps } from '~/Components/ActionMenu.js'
import { trpc, useMutationExt } from '~/Resources/TRPC.js'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import type { ButtonGridStore } from './ButtonGridStore.js'
import { buildTransferPairs, type GridToolActions } from './GridTools/index.js'

interface UseButtonContextMenuOptions {
	store: ButtonGridStore
	actions: GridToolActions
	setTabResetToken: (token: string) => void
}

export interface UseButtonContextMenuResult {
	contextMenuOpen: boolean
	setContextMenuOpen: (open: boolean) => void
	contextMenuPosition: { x: number; y: number }
	contextMenuLocation: ControlLocation | null
	contextMenuItems: MenuItemProps[]
	doButtonContextMenu: (location: ControlLocation, x: number, y: number) => void
}

export function useButtonContextMenu({
	store,
	actions,
	setTabResetToken,
}: UseButtonContextMenuOptions): UseButtonContextMenuResult {
	const { pages } = useContext(RootAppStoreContext)

	const [contextMenuLocation, setContextMenuLocation] = useState<ControlLocation | null>(null)
	const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 })
	const [contextMenuOpen, setContextMenuOpen] = useState(false)

	// The clipboard lives in the grid store, so a pending cut/copy highlights its source on the grid
	// and is shared with the keyboard shortcuts
	const clipboard = useSyncExternalStore(
		store.subscribe,
		useCallback(() => store.clipboard, [store])
	)

	const doButtonContextMenu = useCallback((location: ControlLocation, x: number, y: number) => {
		setContextMenuLocation(location)
		setContextMenuPosition({ x, y })
		setContextMenuOpen(true)
	}, [])

	const contextControlId = contextMenuLocation ? pages.getControlIdAtLocation(contextMenuLocation) : undefined

	const hotPressMutation = useMutationExt(trpc.controls.hotPressControl.mutationOptions())
	const hotAbortMutation = useMutationExt(trpc.controls.hotAbortControl.mutationOptions())
	const createReferenceControlMutation = useMutationExt(trpc.controls.createReferenceControl.mutationOptions())

	const contextMenuItems = useMemo((): MenuItemProps[] => {
		if (!contextMenuLocation) return []

		const location = contextMenuLocation
		const isEmpty = !contextControlId

		const pasteLabel = clipboard?.mode === 'cut' ? 'Move here' : 'Paste here'

		const items: MenuItemProps[] = [
			{
				label: 'Press',
				disabled: isEmpty,
				do: () => {
					hotPressMutation
						.mutateAsync({ location, direction: true, surfaceId: 'context-menu' })
						.then(async () => hotPressMutation.mutateAsync({ location, direction: false, surfaceId: 'context-menu' }))
						.catch((e) => console.error(`Hot press failed: ${e}`))
				},
			},
			{
				label: 'Abort Actions',
				disabled: isEmpty,
				do: () => {
					hotAbortMutation.mutateAsync({ location }).catch((e) => console.error(`Hot abort failed: ${e}`))
				},
			},
			{ isSeparator: true, label: 'Edit' },
			{
				label: 'Copy',
				disabled: isEmpty,
				do: () => {
					store.setClipboard([location], 'copy')
				},
			},
			{
				label: 'Cut',
				disabled: isEmpty,
				do: () => {
					store.setClipboard([location], 'cut')
				},
			},
		]

		if (!clipboard) {
			items.push(
				{ label: 'Paste here', disabled: true, do: () => {} },
				{ label: 'Swap here', disabled: true, do: () => {} },
				{ label: 'Paste as reference', disabled: true, do: () => {} }
			)
		} else {
			items.push(
				{
					label: pasteLabel,
					do: () => {
						actions.transfer(
							clipboard.mode === 'cut' ? 'move' : 'copy',
							buildTransferPairs(clipboard.locations, location)
						)
						if (clipboard.mode === 'cut') store.clearClipboard()
						setTabResetToken(nanoid())
					},
				},
				{
					label: 'Swap here',
					do: () => {
						actions.transfer('swap', buildTransferPairs(clipboard.locations, location))
						store.clearClipboard()
						setTabResetToken(nanoid())
					},
				},
				{
					label: 'Paste as reference',
					disabled: clipboard.locations.length !== 1,
					do: () => {
						// Place a button that mirrors the copied button, rather than a full copy
						createReferenceControlMutation
							.mutateAsync({ fromLocation: clipboard.locations[0], toLocation: location })
							.catch((e) => console.error(`Paste reference failed: ${e}`))
						// A reference leaves the source in place, so clear a pending cut - it never completes otherwise
						if (clipboard.mode === 'cut') store.clearClipboard()
						setTabResetToken(nanoid())
					},
				}
			)
		}

		items.push(
			{ isSeparator: true },
			{
				label: 'Clear',
				disabled: isEmpty,
				do: () => actions.clearButtons([location]),
			}
		)

		return items
	}, [
		contextMenuLocation,
		contextControlId,
		clipboard,
		store,
		actions,
		hotPressMutation,
		hotAbortMutation,
		createReferenceControlMutation,
		setTabResetToken,
	])

	return {
		contextMenuOpen,
		setContextMenuOpen,
		contextMenuPosition,
		contextMenuLocation,
		contextMenuItems,
		doButtonContextMenu,
	}
}
