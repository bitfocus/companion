import { VisitorReferencesUpdater } from './ReferencesUpdater.js'
import { visitEventOptions } from '../EventDefinitions.js'
import { visitFeedbackInstance } from './FeedbackInstanceVisitor.js'
import type { InternalController } from '../../Internal/Controller.js'
import type { InternalVisitor } from '../../Internal/Types.js'
import type { ButtonStyleProperties } from '@companion-app/shared/Model/StyleModel.js'
import type { FragmentFeedbackInstance } from '../../Controls/Fragments/FragmentFeedbackInstance.js'
import type { ActionInstance } from '@companion-app/shared/Model/ActionModel.js'
import type { FeedbackInstance } from '@companion-app/shared/Model/FeedbackModel.js'
import type { EventInstance } from '@companion-app/shared/Model/EventModel.js'
import type { FragmentActionInstance } from '../../Controls/Fragments/FragmentActionInstance.js'
import { visitActionInstance } from './ActionInstanceVisitor.js'

export class ReferencesVisitors {
	/**
	 * Visit any references within the given control
	 * @param internalModule
	 * @param visitor Visitor to be used
	 * @param style Style object of the control (if any)
	 * @param rawActions  Array of unprocessed actions belonging to the control
	 * @param rawFeedbacks Array of unprocessed feedbacks belonging to the control
	 * @param actions Array of actions belonging to the control
	 * @param feedbacks Array of loaded feedbacks belonging to the control
	 * @param events Array of events belonging to the control
	 */
	static visitControlReferences(
		internalModule: InternalController,
		visitor: InternalVisitor,
		style: ButtonStyleProperties | undefined,
		rawActions: ActionInstance[],
		rawFeedbacks: FeedbackInstance[],
		actions: FragmentActionInstance[],
		feedbacks: FragmentFeedbackInstance[],
		events: EventInstance[]
	): void {
		// Update the base style
		if (style) visitor.visitString(style, 'text')

		// Apply any updates to the internal actions/feedbacks
		internalModule.visitReferences(visitor, rawActions, actions, rawFeedbacks, feedbacks)

		for (const feedback of rawFeedbacks) {
			visitFeedbackInstance(visitor, feedback)
		}

		for (const feedback of feedbacks) {
			feedback.visitReferences(visitor)
		}

		// Fixup any references in action options
		for (const action of rawActions) {
			visitActionInstance(visitor, action)
		}

		for (const action of actions) {
			action.visitReferences(visitor)
		}

		// Fixup any references in event options
		for (const event of events) {
			visitEventOptions(visitor, event)
		}
	}

	/**
	 * Fixup any references within the given control
	 * @param internalModule
	 * @param updateMaps Description of instance ids and labels to remap
	 * @param style Style object of the control (if any)
	 * @param rawActions  Array of unprocessed actions belonging to the control
	 * @param rawFeedbacks Array of unprocessed feedbacks belonging to the control
	 * @param actions Array of actions belonging to the control
	 * @param feedbacks Array of loaded feedbacks belonging to the control
	 * @param events Array of events belonging to the control
	 * @param recheckChangedFeedbacks Whether to recheck the feedbacks that were modified
	 * @returns Whether any changes were made
	 */
	static fixupControlReferences(
		internalModule: InternalController,
		updateMaps: FixupReferencesUpdateMaps,
		style: ButtonStyleProperties | undefined,
		rawActions: ActionInstance[],
		rawFeedbacks: FeedbackInstance[],
		actions: FragmentActionInstance[],
		feedbacks: FragmentFeedbackInstance[],
		events: EventInstance[],
		recheckChangedFeedbacks: boolean
	): boolean {
		const visitor = new VisitorReferencesUpdater(updateMaps.connectionLabels, updateMaps.connectionIds)

		this.visitControlReferences(internalModule, visitor, style, rawActions, rawFeedbacks, actions, feedbacks, events)

		// Trigger the feedbacks to be rechecked, this will cause a redraw if needed
		if (recheckChangedFeedbacks && visitor.changedFeedbackIds.size > 0) {
			internalModule.checkFeedbacksById(...visitor.changedFeedbackIds)
		}

		return visitor.changed
	}
}

export interface FixupReferencesUpdateMaps {
	connectionLabels?: Record<string, string>
	connectionIds?: Record<string, string>
}
