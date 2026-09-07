import { useDragDropMonitor } from '@dnd-kit/react'
import { useCallback } from 'react'
import { formatLocation } from '@companion-app/shared/ControlId.js'
import type { ControlLocation } from '@companion-app/shared/Model/Common.js'
import type { UserConfigGridSize } from '@companion-app/shared/Model/UserConfigModel.js'
import { trpc, useMutationExt } from '~/Resources/TRPC.js'
import type { ButtonGridStore } from './ButtonGridStore.js'
import { GRID_BUTTON_DRAG_TYPE, type GridButtonDragItem } from './GridButtonDragItem.js'
import { parseGridButtonDroppableId } from './GridButtonDroppableId.js'
import { planGridDrop } from './GridDragDrop.js'
import { previewPlacements } from './GridGeometry.js'
import type { GridToolActions } from './GridTools/index.js'
import type { PresetDragItem } from './Presets/PresetDragItem.js'

export interface UseGridDropMonitorOptions {
	store: ButtonGridStore
	/** Undefined until the user config has arrived, when nothing can be dropped anywhere yet */
	gridSize: UserConfigGridSize | undefined
	isOccupied: (location: ControlLocation) => boolean
	actions: GridToolActions
}

/**
 * What a drag released over the grid does.
 *
 * Subscribed via the global dnd-kit provider, so drags of every kind arrive here and are filtered by
 * type: a preset from the presets tab is imported where it lands, and a button from the grid is
 * moved or swapped.
 */
export function useGridDropMonitor({ store, gridSize, isOccupied, actions }: UseGridDropMonitorOptions): void {
	// Resolving the drag the same way for the preview and for the drop is what stops the two
	// disagreeing about where the buttons were going to land
	const resolveGridDrop = useCallback(
		(source: { data: unknown } | null, targetId: unknown) => {
			if (!gridSize) return null

			const destination = parseGridButtonDroppableId(targetId)
			if (!destination) return null

			const origin = (source?.data as GridButtonDragItem | undefined)?.location
			if (!origin) return null

			// Dragging a button that is part of the selection takes the whole selection with it
			const selection = store.selectedLocations
			const originKey = formatLocation(origin)
			const sources = selection.some((l) => formatLocation(l) === originKey) ? [...selection] : [origin]

			return planGridDrop(origin, destination, sources, gridSize, isOccupied)
		},
		[gridSize, store, isOccupied]
	)

	const importPresetMutation = useMutationExt(trpc.controls.importPreset.mutationOptions())

	useDragDropMonitor({
		onDragOver(event) {
			const { source, target } = event.operation
			if (!source || source.type !== GRID_BUTTON_DRAG_TYPE) return

			const plan = target ? resolveGridDrop(source, target.id) : null
			store.setDragPreview(
				plan ? { placements: previewPlacements(plan.operation, plan.pairs), valid: plan.fitsOnGrid } : null
			)
		},
		onDragEnd(event) {
			store.setDragPreview(null)

			if (event.canceled) return
			const { source, target } = event.operation
			if (!source || !target) return

			if (source.type === 'preset') {
				const location = parseGridButtonDroppableId(target.id)
				if (!location) return

				const dropData = source.data as PresetDragItem
				importPresetMutation
					.mutateAsync({
						connectionId: dropData.connectionId,
						presetId: dropData.presetId,
						location,
						variableValues: dropData.variableValues,
						mode: dropData.mode,
					})
					.catch(() => {
						console.error('Preset import failed')
					})
				return
			}

			if (source.type !== GRID_BUTTON_DRAG_TYPE) return

			const plan = resolveGridDrop(source, target.id)
			// A region that would hang off the grid is refused outright rather than dropping the part
			// that happens to fit - the preview said as much while it was still being held
			if (!plan || !plan.fitsOnGrid) return

			// Overwriting is confirmed inside `transfer`, the same way it is for every other way of
			// moving buttons about
			actions.transfer(plan.operation, plan.pairs, () => undefined)
		},
	})
}
