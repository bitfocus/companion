import { nanoid } from 'nanoid'
import { useCallback, useContext, useMemo, useState } from 'react'
import { formatLocation } from '@companion-app/shared/ControlId.js'
import type { ControlLocation } from '@companion-app/shared/Model/Common.js'
import type { MenuItemProps } from '~/Components/ActionMenu.js'
import type { GenericConfirmModalRef } from '~/Components/GenericConfirmModal.js'
import { trpc, useMutationExt } from '~/Resources/TRPC.js'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'

interface UseButtonContextMenuOptions {
	copyFromButton: [ControlLocation, string] | null
	setCopyFromButton: (value: [ControlLocation, string] | null) => void
	clearModalRef: React.RefObject<GenericConfirmModalRef | null>
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
	copyFromButton,
	setCopyFromButton,
	clearModalRef,
	setTabResetToken,
}: UseButtonContextMenuOptions): UseButtonContextMenuResult {
	const { pages } = useContext(RootAppStoreContext)

	const [contextMenuLocation, setContextMenuLocation] = useState<ControlLocation | null>(null)
	const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 })
	const [contextMenuOpen, setContextMenuOpen] = useState(false)

	const doButtonContextMenu = useCallback((location: ControlLocation, x: number, y: number) => {
		setContextMenuLocation(location)
		setContextMenuPosition({ x, y })
		setContextMenuOpen(true)
	}, [])

	const contextControlId = contextMenuLocation ? pages.getControlIdAtLocation(contextMenuLocation) : undefined

	const hotPressMutation = useMutationExt(trpc.controls.hotPressControl.mutationOptions())
	const hotAbortMutation = useMutationExt(trpc.controls.hotAbortControl.mutationOptions())
	const copyControlMutation = useMutationExt(trpc.controls.copyControl.mutationOptions())
	const moveControlMutation = useMutationExt(trpc.controls.moveControl.mutationOptions())
	const swapControlMutation = useMutationExt(trpc.controls.swapControl.mutationOptions())
	const resetControlMutation = useMutationExt(trpc.controls.resetControl.mutationOptions())
	const createReferenceControlMutation = useMutationExt(trpc.controls.createReferenceControl.mutationOptions())

	const contextMenuItems = useMemo((): MenuItemProps[] => {
		if (!contextMenuLocation) return []

		const location = contextMenuLocation
		const isEmpty = !contextControlId

		const pasteLabel = copyFromButton?.[1] === 'cut' ? 'Move here' : 'Paste here'

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
					setCopyFromButton([location, 'copy'])
				},
			},
			{
				label: 'Cut',
				disabled: isEmpty,
				do: () => {
					setCopyFromButton([location, 'cut'])
				},
			},
		]

		if (!copyFromButton) {
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
						if (copyFromButton[1] === 'copy') {
							copyControlMutation
								.mutateAsync({ fromLocation: copyFromButton[0], toLocation: location })
								.catch((e) => console.error(`Copy failed: ${e}`))
							setTabResetToken(nanoid())
						} else if (copyFromButton[1] === 'cut') {
							moveControlMutation
								.mutateAsync({ fromLocation: copyFromButton[0], toLocation: location })
								.catch((e) => console.error(`Move failed: ${e}`))
							setCopyFromButton(null)
							setTabResetToken(nanoid())
						}
					},
				},
				{
					label: 'Swap here',
					do: () => {
						swapControlMutation
							.mutateAsync({ fromLocation: copyFromButton[0], toLocation: location })
							.catch((e) => console.error(`Swap failed: ${e}`))
						setCopyFromButton(null)
						setTabResetToken(nanoid())
					},
				},
				{
					label: 'Paste as reference',
					do: () => {
						// Place a button that mirrors the copied button, rather than a full copy
						createReferenceControlMutation
							.mutateAsync({ fromLocation: copyFromButton[0], toLocation: location })
							.catch((e) => console.error(`Paste reference failed: ${e}`))
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
				do: () => {
					clearModalRef.current?.show(
						`Clear button ${formatLocation(location)}`,
						`This will clear the style, feedbacks and all actions`,
						'Clear',
						() => {
							resetControlMutation.mutateAsync({ location }).catch((e) => {
								console.error(`Reset failed: ${e}`)
							})
						}
					)
				},
			}
		)

		return items
	}, [
		contextMenuLocation,
		contextControlId,
		copyFromButton,
		hotPressMutation,
		hotAbortMutation,
		copyControlMutation,
		moveControlMutation,
		swapControlMutation,
		resetControlMutation,
		createReferenceControlMutation,
		setCopyFromButton,
		setTabResetToken,
		clearModalRef,
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
