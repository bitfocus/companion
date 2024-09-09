import type { ControlLocation } from '../Resources/Util.js'
import type { FeedbackInstance } from '../Controls/IControlFragments.js'
import type { VisitorReferencesCollector } from '../Util/Visitors/ReferencesCollector.js'
import type { VisitorReferencesUpdater } from '../Util/Visitors/ReferencesUpdater.js'
import { CompanionOptionValues } from '@companion-module/base'

export * from '@companion-app/shared/Model/Options.js'
export * from '@companion-app/shared/Model/ActionDefinitionModel.js'
export * from '@companion-app/shared/Model/FeedbackDefinitionModel.js'

export interface FeedbackInstanceExt extends FeedbackInstance {
	controlId: string
	location: ControlLocation | undefined
	referencedVariables: string[] | null
}

export type InternalVisitor = VisitorReferencesCollector | VisitorReferencesUpdater

/**
 * A minimal representation of a feedback, for visiting internal feedbacks.
 */
export interface FeedbackForVisitor {
	id: string
	type: string
	options: CompanionOptionValues
}
