import type { VariableValues } from '@companion-app/shared/Model/Variables.js'

export interface PresetDragItem {
	connectionId: string
	presetId: string
	variableValues: VariableValues | null
}
