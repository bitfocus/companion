import { visitEventOptions } from '../EventDefinitions.js'
import { visitEntityModel } from './EntityInstanceVisitor.js'
import type { InternalController } from '../../Internal/Controller.js'
import type { InternalVisitor } from '../../Internal/Types.js'
import type { ButtonStyleProperties } from '@companion-app/shared/Model/StyleModel.js'
import type { EventInstance } from '@companion-app/shared/Model/EventModel.js'
import type { SomeEntityModel } from '@companion-app/shared/Model/EntityModel.js'
import type { ControlEntityInstance } from '../../Controls/Entities/EntityInstance.js'

export class VisitorReferencesBase<T extends InternalVisitor> {
	protected readonly internalModule: InternalController
	protected readonly visitor: T

	constructor(internalModule: InternalController, visitor: T) {
		this.internalModule = internalModule
		this.visitor = visitor
	}

	visitButtonDrawStlye(style: ButtonStyleProperties): this {
		this.visitor.visitString(style, 'text')

		return this
	}

	visitEntities(entities: ControlEntityInstance[], rawEntities: SomeEntityModel[]): this {
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
		this.internalModule.visitReferences(this.visitor, flatRawEntities, entities)

		for (const entity of flatRawEntities) {
			visitEntityModel(this.visitor, entity)
		}

		for (const entity of entities) {
			entity.visitReferences(this.visitor)
		}

		return this
	}

	visitEvents(events: EventInstance[]): this {
		// Fixup any references in event options
		for (const event of events) {
			visitEventOptions(this.visitor, event)
		}

		return this
	}
}
