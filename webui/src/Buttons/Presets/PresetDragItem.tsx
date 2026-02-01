import type { VariableValues } from '@companion-app/shared/Model/Variables.js'

export interface PresetDragItem {
	connectionId: string
	presetId: string
	matrixValues: VariableValues | null
}
