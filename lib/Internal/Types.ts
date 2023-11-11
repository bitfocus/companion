import type { ControlLocation } from '../Resources/Util.js'
import type { FeedbackInstance } from '../Controls/IControlFragments.js'
import type { VisitorReferencesCollector } from '../Util/Visitors/ReferencesCollector.js'
import type { VisitorReferencesUpdater } from '../Util/Visitors/ReferencesUpdater.js'
import { SomeCompanionActionInputField } from '@companion-module/base'

export interface FeedbackInstanceExt extends FeedbackInstance {
	controlId: string
	location: ControlLocation | undefined
	referencedVariables: string[] | null
}

export type InternalVisitor = VisitorReferencesCollector | VisitorReferencesUpdater

export type InternalInputField = (
	| {
			type: 'internal:time'
	  }
	| {
			type: 'internal:variable'
			default: string
	  }
	| {
			type: 'internal:custom_variable'
			includeNone?: boolean
	  }
	| {
			type: 'internal:trigger'
			includeSelf?: boolean
			default?: string
	  }
	| {
			type: 'internal:instance_id'
			multiple?: boolean
			includeAll?: boolean
			filterActionsRecorder?: boolean
			default?: string[]
	  }
	| {
			type: 'internal:surface_serial'
			includeSelf: boolean
			default: string
	  }
	| {
			type: 'internal:page'
			includeDirection: boolean
			default: number
	  }
	| {
			type: 'internal:variable'
	  }
) &
	Omit<import('@companion-module/base').CompanionInputFieldBase, 'type'>

export type InternalActionInputField = SomeCompanionActionInputField | InternalInputField

export interface InternalActionDefinition {
	label: string
	description?: string
	options: InternalActionInputField[]
	hasLearn?: boolean
	showButtonPreview?: boolean
}
