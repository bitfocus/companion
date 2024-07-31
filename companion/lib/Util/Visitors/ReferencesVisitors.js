import { VisitorReferencesUpdater } from './ReferencesUpdater.js'
import { visitEventOptions } from '../../Resources/EventDefinitions.js'
import { visitFeedbackInstance } from './FeedbackInstanceVisitor.js'

export class ReferencesVisitors {
	/**
	 * Visit any references within the given control
	 * @param {import('../../Internal/Controller.js').default} internalModule
	 * @param {import('../../Internal/Types.js').InternalVisitor} visitor Visitor to be used
	 * @param {import('@companion-app/shared/Model/StyleModel.js').ButtonStyleProperties | undefined} style Style object of the control (if any)
	 * @param {import('@companion-app/shared/Model/ActionModel.js').ActionInstance[]} actions Array of actions belonging to the control
	 * @param {import('@companion-app/shared/Model/FeedbackModel.js').FeedbackInstance[]} rawFeedbacks Array of unprocessed feedbacks belonging to the control
	 * @param {import('../../Controls/Fragments/FragmentFeedbackInstance.js').FragmentFeedbackInstance[]} feedbacks Array of loaded feedbacks belonging to the control
	 * @param {import('@companion-app/shared/Model/EventModel.js').EventInstance[]} events Array of events belonging to the control
	 */
	static visitControlReferences(internalModule, visitor, style, actions, rawFeedbacks, feedbacks, events) {
		// Update the base style
		if (style) visitor.visitString(style, 'text')

		// Apply any updates to the internal actions/feedbacks
		internalModule.visitReferences(visitor, actions, rawFeedbacks, feedbacks)

		for (const feedback of rawFeedbacks) {
			visitFeedbackInstance(visitor, feedback)
		}

		for (const feedback of feedbacks) {
			feedback.visitReferences(visitor)
		}

		// Fixup any references in action options
		for (const action of actions) {
			for (const key of Object.keys(action.options || {})) {
				visitor.visitString(action.options, key)
			}
		}

		// Fixup any references in event options
		for (const event of events) {
			visitEventOptions(visitor, event)
		}
	}

	/**
	 * Fixup any references within the given control
	 * @param {import('../../Internal/Controller.js').default} internalModule
	 * @param {FixupReferencesUpdateMaps} updateMaps Description of instance ids and labels to remap
	 * @param {import('@companion-app/shared/Model/StyleModel.js').ButtonStyleProperties | undefined} style Style object of the control (if any)
	 * @param {import('@companion-app/shared/Model/ActionModel.js').ActionInstance[]} actions Array of actions belonging to the control
	 * @param {import('@companion-app/shared/Model/FeedbackModel.js').FeedbackInstance[]} rawFeedbacks Array of unprocessed feedbacks belonging to the control
	 * @param {import('../../Controls/Fragments/FragmentFeedbackInstance.js').FragmentFeedbackInstance[]} feedbacks Array of loaded feedbacks belonging to the control
	 * @param {import('@companion-app/shared/Model/EventModel.js').EventInstance[]} events Array of events belonging to the control
	 * @param {boolean} recheckChangedFeedbacks Whether to recheck the feedbacks that were modified
	 * @returns {boolean} Whether any changes were made
	 */
	static fixupControlReferences(
		internalModule,
		updateMaps,
		style,
		actions,
		rawFeedbacks,
		feedbacks,
		events,
		recheckChangedFeedbacks
	) {
		const visitor = new VisitorReferencesUpdater(updateMaps.connectionLabels, updateMaps.connectionIds)

		this.visitControlReferences(internalModule, visitor, style, actions, rawFeedbacks, feedbacks, events)

		// Trigger the feedbacks to be rechecked, this will cause a redraw if needed
		if (recheckChangedFeedbacks && visitor.changedFeedbackIds.size > 0) {
			internalModule.checkFeedbacksById(...visitor.changedFeedbackIds)
		}

		return visitor.changed
	}
}

/**
 * @typedef {{
 *   connectionLabels?: Record<string, string>
 *   connectionIds?: Record<string, string>
 * }} FixupReferencesUpdateMaps
 */
