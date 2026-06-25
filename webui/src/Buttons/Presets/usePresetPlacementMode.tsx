import { useLocalStorage } from 'usehooks-ts'
import type { PresetPlacementMode } from './PresetDragItem.js'

/**
 * Whether newly dropped presets are placed as live references or one-off copies.
 * Persisted in localStorage and shared (in-tab) between the Presets panel toggle and the draggable icons.
 * Defaults to 'reference'.
 */
export function usePresetPlacementMode(): [PresetPlacementMode, (mode: PresetPlacementMode) => void] {
	const [mode, setMode] = useLocalStorage<PresetPlacementMode>('presets.placementMode', 'reference')
	return [mode, setMode]
}
