import { useCallback, useMemo } from 'react'
import { formatLocation, isLocationOnGrid } from '@companion-app/shared/ControlId.js'
import type { ControlLocation } from '@companion-app/shared/Model/Common.js'
import type { UserConfigGridSize } from '@companion-app/shared/Model/UserConfigModel.js'
import type { GenericConfirmModalRef } from '~/Components/GenericConfirmModal.js'
import { trpc, useMutationExt } from '~/Resources/TRPC.js'
import type { ButtonGridStore } from './ButtonGridStore.js'
import { buildTransferPairs } from './GridGeometry.js'
import type { GridToolActions, GridTransferPair } from './GridTools/index.js'
import { planGridTransferRequest } from './GridTransferRequest.js'

export interface UseGridToolActionsOptions {
	store: ButtonGridStore
	/** Undefined until the user config has arrived, when nothing can be placed anywhere yet */
	gridSize: UserConfigGridSize | undefined
	isOccupied: (location: ControlLocation) => boolean
	openEditor: (location: ControlLocation) => void
	/** Asks before anything that cannot be undone, and explains a paste that would go nowhere */
	confirmRef: React.RefObject<GenericConfirmModalRef | null>
	/** Something on the grid has changed, so anything showing a button needs rebuilding */
	onGridChanged: () => void
}

/**
 * Everything a tool can make happen, in one place.
 *
 * Every way of moving buttons around the grid - the toolbar tools, dragging, pasting, the context
 * menu - ends up here, so the things that must never happen quietly are checked once rather than in
 * each of them.
 */
export function useGridToolActions({
	store,
	gridSize,
	isOccupied,
	openEditor,
	confirmRef,
	onGridChanged,
}: UseGridToolActionsOptions): GridToolActions {
	const resetControlsMutation = useMutationExt(trpc.controls.resetControls.mutationOptions())
	const gridBatchTransferMutation = useMutationExt(trpc.controls.gridBatchTransfer.mutationOptions())
	const hotPressMutation = useMutationExt(trpc.controls.hotPressControl.mutationOptions())

	// A button placed outside the grid is somewhere nothing can reach it, so the tools refuse a
	// placement that would do that rather than clamping it to the edge
	const fitsOnGrid = useCallback(
		(locations: ControlLocation[]) => {
			if (!gridSize) return false

			return locations.every((location) => isLocationOnGrid(gridSize, location))
		},
		[gridSize]
	)

	const transfer = useCallback<GridToolActions['transfer']>(
		(operation, pairs: GridTransferPair[], onApplied: () => void) => {
			const request = planGridTransferRequest(operation, pairs, { isOccupied, fitsOnGrid })
			// Nothing to carry, or it would land off the grid. `pasteAt` explains the latter, since a
			// keyboard paste has no ghost to have shown it coming; everywhere else it is a no-op.
			if (request.outcome === 'nothing' || request.outcome === 'off-grid') return

			const carrying = request.pairs
			const apply = () => {
				// One request for the whole lot, so overlapping regions are resolved against the state
				// as it was before anything moved, and a rejection leaves nothing half-applied
				gridBatchTransferMutation
					.mutateAsync({ operation, pairs: carrying })
					.catch((e) => console.error(`${operation} failed: ${e}`))

				// Follow the buttons to where they landed. Leaving the old positions selected points at
				// where they used to be, which is no use for whatever you want to do next.
				store.setSelection(carrying.map((pair) => pair.toLocation))
				onGridChanged()
				onApplied()
			}

			if (request.outcome === 'overwrites') {
				const count = request.overwritten.length
				confirmRef.current?.show(
					`Overwrite ${describeButtons(count)}`,
					[`This will replace ${describeButtons(count)} already here.`, `There's no going back from this.`],
					'Overwrite',
					apply
				)
				return
			}

			apply()
		},
		[isOccupied, fitsOnGrid, gridBatchTransferMutation, store, confirmRef, onGridChanged]
	)

	// Both the keyboard and the context menu paste through here, so a paste costs the same either way
	const pasteAt = useCallback(
		(location: ControlLocation) => {
			const clipboard = store.clipboard
			if (!clipboard || !gridSize) return

			const operation = clipboard.mode === 'cut' ? 'move' : 'copy'
			// Top-left, not centred like the tools: a paste names its destination rather than pointing at
			// it, with no ghost to show which cell of the region the answer was measured from
			const pairs = buildTransferPairs(clipboard.locations, location, 'top-left')

			// `transfer` refuses this anyway, but silently - and a paste that appears to do nothing at all
			// is worth explaining, since there is no ghost under a keyboard paste to have shown it coming
			const request = planGridTransferRequest(operation, pairs, { isOccupied, fitsOnGrid })
			if (request.outcome === 'off-grid') {
				confirmRef.current?.show(
					`Cannot paste here`,
					[
						`${request.offGrid.length} of the ${describeButtons(request.pairs.length)} would land outside the grid.`,
						`Nothing has been pasted. Try somewhere with more room, or make the grid bigger.`,
					],
					'OK',
					() => undefined
				)
				return
			}

			// Overwriting is confirmed inside `transfer`, so a cut is only spent once the paste has
			// actually happened
			transfer(operation, pairs, () => {
				if (clipboard.mode === 'cut') store.clearClipboard()
			})
		},
		[store, gridSize, isOccupied, fitsOnGrid, confirmRef, transfer]
	)

	return useMemo<GridToolActions>(
		() => ({
			openEditor,
			fitsOnGrid,
			isOccupied,
			transfer,
			pasteAt,
			press: (location, isDown) => {
				hotPressMutation
					.mutateAsync({ location, direction: isDown, surfaceId: 'grid' })
					.catch((e) => console.error(`Hot press failed: ${e}`))
			},
			clearButtons: (locations) => {
				if (locations.length === 0) return

				const description =
					locations.length === 1 ? `Clear button ${formatLocation(locations[0])}` : `Clear ${locations.length} buttons`

				confirmRef.current?.show(description, `This will clear the style, feedbacks and all actions`, 'Clear', () => {
					resetControlsMutation.mutateAsync({ locations: [...locations], newType: null }).catch((e) => {
						console.error(`Reset failed: ${e}`)
					})
				})
			},
		}),
		[openEditor, fitsOnGrid, isOccupied, transfer, pasteAt, hotPressMutation, resetControlsMutation, confirmRef]
	)
}

function describeButtons(count: number): string {
	return count === 1 ? '1 button' : `${count} buttons`
}
