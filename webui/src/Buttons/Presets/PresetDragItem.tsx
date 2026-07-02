import type { VariableValues } from '@companion-app/shared/Model/Variables.js'

/** Whether dropping a preset places a live reference to it, or a one-off copy of its data */
export type PresetPlacementMode = 'copy' | 'reference'

export interface PresetDragItem {
	connectionId: string
	presetId: string
	variableValues: VariableValues | null
	mode: PresetPlacementMode
}
