import type { JsonValue } from 'type-fest'
import { isInternalConnectionId } from '@companion-app/shared/ConnectionId.js'
import type { SomeEntityModel } from '@companion-app/shared/Model/EntityModel.js'
import type { EventInstance } from '@companion-app/shared/Model/EventModel.js'
import type { ExpressionOrValue } from '@companion-app/shared/Model/Options.js'
import type { SomeButtonGraphicsElement } from '@companion-app/shared/Model/StyleLayersModel.js'
import type { ControlEntityInstance } from '../../Controls/Entities/EntityInstance.js'
import type { InternalController } from '../../Internal/Controller.js'
import type { InternalVisitor } from '../../Internal/Types.js'
import { visitEventOptions } from '../EventDefinitions.js'
import { visitEntityModel } from './EntityInstanceVisitor.js'

export class VisitorReferencesBase<T extends InternalVisitor> {
	protected readonly internalModule: InternalController
	protected readonly visitor: T

	constructor(internalModule: InternalController, visitor: T) {
		this.internalModule = internalModule
		this.visitor = visitor
	}

	/**
	 * Visit live entity instances. This does not recurse into children: pass an already flattened list, such as
	 * from `getAllEntities()`.
	 */
	visitEntityInstances(entities: ControlEntityInstance[]): this {
		// Apply any updates to the internal actions/feedbacks
		this.internalModule.visitReferences(this.visitor, [], entities)

		for (const entity of entities) {
			entity.visitReferences(this.visitor)
		}

		return this
	}

	/**
	 * Visit entity models, recursing into the children of internal entities
	 */
	visitEntityModels(entities: SomeEntityModel[]): this {
		const flatEntities: SomeEntityModel[] = []
		const pluckEntities = (entities: SomeEntityModel[]) => {
			for (const entity of entities) {
				flatEntities.push(entity)
				if (isInternalConnectionId(entity.connectionId) && entity.children) {
					for (const children of Object.values(entity.children)) {
						if (children) pluckEntities(children)
					}
				}
			}
		}
		pluckEntities(entities)

		// Apply any updates to the internal actions/feedbacks
		this.internalModule.visitReferences(this.visitor, flatEntities, [])

		for (const entity of flatEntities) {
			visitEntityModel(this.visitor, entity)
		}

		return this
	}

	/**
	 * Visit a standalone {@link ExpressionOrValue} (e.g. a control option not held as a draw element). Expressions
	 * are always visited; pass `visitPlainValue` to also rename variables inside a plain string value.
	 */
	visitExpressionOrValue(value: ExpressionOrValue<JsonValue | undefined>, visitPlainValue = false): this {
		if (value.isExpression || (visitPlainValue && typeof value.value === 'string')) {
			this.visitor.visitString(value, 'value')
		}

		return this
	}

	visitDrawElements(elements: SomeButtonGraphicsElement[]): this {
		for (const element of elements) {
			for (const key in element) {
				// Ignore some special/fixed properties
				if (key === 'id' || key === 'type' || key === 'name') continue

				// Check for an expressions in the property
				const prop = element[key as keyof typeof element] as any as ExpressionOrValue<JsonValue | undefined>
				if (prop && typeof prop === 'object' && (prop.isExpression || typeof prop.value === 'string')) {
					this.visitor.visitString(prop, 'value')
				}
			}

			if (element.type === 'composite') this.visitor.visitConnectionId(element, 'connectionId')
			if (element.type === 'group') this.visitDrawElements(element.children)
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
