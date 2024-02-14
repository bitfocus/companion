import type { ControlLocation } from '../Resources/Util.js'
import type { FeedbackInstance } from '../Controls/IControlFragments.js'
import type { VisitorReferencesCollector } from '../Util/Visitors/ReferencesCollector.js'
import type { VisitorReferencesUpdater } from '../Util/Visitors/ReferencesUpdater.js'

export * from '../Shared/Model/Options.js'

export interface FeedbackInstanceExt extends FeedbackInstance {
	controlId: string
	location: ControlLocation | undefined
	referencedVariables: string[] | null
}

export type InternalVisitor = VisitorReferencesCollector | VisitorReferencesUpdater
