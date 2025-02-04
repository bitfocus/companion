import { VisitorReferencesUpdater } from './ReferencesUpdater.js'
import { visitEventOptions } from '../EventDefinitions.js'
import { visitEntityModel } from './EntityInstanceVisitor.js'
import type { InternalController } from '../../Internal/Controller.js'
import type { InternalVisitor } from '../../Internal/Types.js'
import type { ButtonStyleProperties } from '@companion-app/shared/Model/StyleModel.js'
import type { EventInstance } from '@companion-app/shared/Model/EventModel.js'
import type { SomeEntityModel } from '@companion-app/shared/Model/EntityModel.js'
import type { ControlEntityInstance } from '../../Controls/Entities/EntityInstance.js'

export class ReferencesVisitors {
	/**
	 * Visit any references within the given control
	 * @param internalModule
	 * @param visitor Visitor to be used
	 * @param style Style object of the control (if any)
	 * @param rawEntities Array of unprocessed entities belonging to the control
	 * @param entities Array of loaded entities belonging to the control
	 * @param events Array of events belonging to the control
	 */
	static visitControlReferences(
		internalModule: InternalController,
		visitor: InternalVisitor,
		style: ButtonStyleProperties | undefined,
		rawEntities: SomeEntityModel[],
		entities: ControlEntityInstance[],
		events: EventInstance[]
	): void {
		// Update the base style
		if (style) visitor.visitString(style, 'text')

		const flatRawEntities: SomeEntityModel[] = []
		const pluckRawEntities = (entities: SomeEntityModel[]) => {
			for (const entity of entities) {
				flatRawEntities.push(entity)
				if (entity.connectionId === 'internal' && entity.children) {
					for (const children of Object.values(entity.children)) {
						if (children) pluckRawEntities(children)
					}
				}
			}
		}
		pluckRawEntities(rawEntities)

		// Apply any updates to the internal actions/feedbacks
		internalModule.visitReferences(visitor, flatRawEntities, entities)

		for (const entity of flatRawEntities) {
			visitEntityModel(visitor, entity)
		}

		for (const entity of entities) {
			entity.visitReferences(visitor)
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
	 * @param rawEntities Array of unprocessed entities belonging to the control
	 * @param entities Array of loaded entities belonging to the control
	 * @param events Array of events belonging to the control
	 * @param recheckChangedFeedbacks Whether to recheck the feedbacks that were modified
	 * @returns Whether any changes were made
	 */
	static fixupControlReferences(
		internalModule: InternalController,
		updateMaps: FixupReferencesUpdateMaps,
		style: ButtonStyleProperties | undefined,
		rawEntities: SomeEntityModel[],
		entities: ControlEntityInstance[],
		events: EventInstance[],
		recheckChangedFeedbacks: boolean
	): boolean {
		const visitor = new VisitorReferencesUpdater(updateMaps.connectionLabels, updateMaps.connectionIds)

		this.visitControlReferences(internalModule, visitor, style, rawEntities, entities, events)

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
