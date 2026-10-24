import { Feedback } from '@dnd-kit/dom'
import type { ControlLocation } from '@companion-app/shared/Model/Common.js'
import type { VariableValues } from '@companion-app/shared/Model/Variables.js'

/** Whether dropping a preset places a live reference to it, or a one-off copy of its data */
export type PresetPlacementMode = 'copy' | 'reference'

/** What dropping a preset on the grid places */
export type PresetDragItem = ConnectionPresetDragItem | LinkPresetDragItem

/** A preset of a connection */
export interface ConnectionPresetDragItem {
	kind: 'connection'
	connectionId: string
	presetId: string
	variableValues: VariableValues | null
	mode: PresetPlacementMode
}

/** A button of another installation, placed as a remote button showing it */
export interface LinkPresetDragItem {
	kind: 'link'
	peerId: string
	location: ControlLocation
}

// Presets drag a clone (the original stays put in the pool) with no drop animation so a
// released preset doesn't fly back. Configured per-draggable so it doesn't affect the default
// sortable feedback (placeholder + settle animation) used everywhere else.
export const PRESET_FEEDBACK_PLUGINS = [Feedback.configure({ feedback: 'clone', dropAnimation: null })]
