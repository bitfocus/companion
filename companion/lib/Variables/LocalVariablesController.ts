/*
 * This file is part of the Companion project
 * Copyright (c) 2018 Bitfocus AS
 * Authors: William Viker <william@bitfocus.io>, Håkon Nessjøen <haakon@bitfocus.io>
 *
 * This program is free software.
 * You should have received a copy of the MIT licence as well as the Bitfocus
 * Individual Contributor License Agreement for companion along with
 * this program.
 */

import { CreatePageControlId } from '@companion-app/shared/ControlId.js'
import type { SomeSocketEntityLocation } from '@companion-app/shared/Model/EntityModel.js'
import { stringifyVariableValue, type VariableValues } from '@companion-app/shared/Model/Variables.js'
import type { JsonValue } from '@companion-module/host'
import type { CustomActionRunFrame } from '../Controls/CustomActionRunFrame.js'
import { isInternalUserValueFeedback, type ControlEntityInstance } from '../Controls/Entities/EntityInstance.js'
import type { EditableEntityListPool, SomeEntityPool } from '../Controls/Entities/EntityListPoolEditingMixin.js'
import type { IControlStore } from '../Controls/IControlStore.js'
import type { RunActionExtras } from '../Instance/Connection/ChildHandlerApi.js'
import { ParseLocationString } from '../Internal/Util.js'
import type { IPageStore } from '../Page/Store.js'

const LocalVariablesList = 'local-variables' satisfies SomeSocketEntityLocation

export type LocalVariable = {
	readonly controlId: string
	readonly name: string
	/**
	 * The run of a custom action which the variable is being used by. Its value is then that of the run, rather
	 * than the value held by the control
	 */
	readonly frame: CustomActionRunFrame | null
}

export class LocalVariablesController {
	readonly #controlsStore: IControlStore
	readonly #pageStore: IPageStore

	constructor(controlsStore: IControlStore, pageStore: IPageStore) {
		this.#controlsStore = controlsStore
		this.#pageStore = pageStore
	}

	#getControlAndVariable({
		controlId,
		name,
	}: LocalVariable): { entities: SomeEntityPool; variableEntity: ControlEntityInstance } | null {
		const control = this.#controlsStore.getControl(controlId)
		if (!control || !control.supportsEntities) return null

		const variableEntity = control.entities
			.getAllEntitiesInList('local-variables')
			.find((ent) => ent.rawLocalVariableName === name)
		if (!variableEntity) return null

		const localVariableName = variableEntity.localVariableName
		if (!localVariableName) return null

		if (!isInternalUserValueFeedback(variableEntity)) return null

		return { entities: control.entities, variableEntity }
	}

	/**
	 * As {@link #getControlAndVariable}, but only for controls whose entity pool is editable (narrowing on the
	 * pool's `isEditable` discriminant). Returns `null` for read-only controls (e.g. a preset reference).
	 *
	 * Only for callers that change the variable's *configuration*. Changing its runtime value must work on
	 * read-only controls too - a preset can carry actions which drive its own local variables - so those use
	 * {@link #getControlAndVariable}.
	 */
	#getEditableControlAndVariable(
		localVariable: LocalVariable
	): { entities: EditableEntityListPool; variableEntity: ControlEntityInstance } | null {
		const found = this.#getControlAndVariable(localVariable)
		if (!found || !found.entities.isEditable) return null

		return { entities: found.entities, variableEntity: found.variableEntity }
	}

	/**
	 * Get a descriptor for the local variable identified by the provided
	 * location/name.  The location may contain special syntax like `this` and so
	 * on.
	 */
	localVariableFor(
		location: JsonValue | undefined,
		name: JsonValue | undefined,
		extras: Pick<RunActionExtras, 'controlId' | 'location' | 'frame'>
	): LocalVariable | null {
		if (!name) return null

		// eslint-disable-next-line @typescript-eslint/no-base-to-string
		name = String(name)

		const locationStr = stringifyVariableValue(location)
		if (!locationStr) return null

		if (locationStr?.trim().toLocaleLowerCase() === 'this') {
			// Inside a custom action, this is the custom action, with the values of the run
			if (extras.frame) return { controlId: extras.frame.customActionControlId, name, frame: extras.frame }

			// This could be any type of control (button, trigger, etc)
			return { controlId: extras.controlId, name, frame: null }
		}

		// Parse the location of a button
		const controlLocation = ParseLocationString(locationStr, extras.location)
		if (!controlLocation) return null

		const controlId = this.#pageStore.getControlIdAt(controlLocation)
		if (!controlId) return null

		return { controlId, name, frame: null }
	}

	/**
	 * Get a descriptor for the page variable identified by the provided page/name.
	 * The page value comes from an `internal:page` picker, where `0` means "this page".
	 * `thisPageNumber` is the page that `0` resolves to (the page of the control in context,
	 * or `null` if it has none).
	 */
	pageVariableFor(
		page: JsonValue | undefined,
		name: JsonValue | undefined,
		thisPageNumber: number | null
	): LocalVariable | null {
		if (!name) return null

		let pageNumber = Number(page)
		if (pageNumber === 0) pageNumber = thisPageNumber ?? NaN
		if (!pageNumber || isNaN(pageNumber)) return null

		const pageId = this.#pageStore.getPageId(pageNumber)
		if (!pageId) return null

		// eslint-disable-next-line @typescript-eslint/no-base-to-string
		return { controlId: CreatePageControlId(pageId), name: String(name), frame: null }
	}

	/**
	 * Build a variable override context for the given local variable.
	 * Returns `this:current` (current value) and `target:<name>` for every local variable
	 * on the same control, suitable for passing to `VariablesAndExpressionParser.createChildParser`.
	 */
	getLocalVariableContextFor(localVariable: LocalVariable): VariableValues | null {
		const controlAndVariable = this.#getControlAndVariable(localVariable)
		if (!controlAndVariable) return null

		const { entities, variableEntity } = controlAndVariable
		const result: VariableValues = {
			'this:current': this.#getValue(variableEntity, localVariable.frame),
		}

		for (const entity of entities.getAllEntitiesInList('local-variables')) {
			const rawName = entity.rawLocalVariableName
			if (!rawName) continue
			result[`target:${rawName}`] = this.#getValue(entity, localVariable.frame)
		}

		return result
	}

	/**
	 * Get the value of a local variable, from the run of a custom action if there is one
	 */
	#getValue(entity: ControlEntityInstance, frame: CustomActionRunFrame | null): JsonValue | undefined {
		const rawName = entity.rawLocalVariableName
		if (frame && rawName && frame.localValues.has(rawName)) return frame.localValues.get(rawName)
		return entity.feedbackValue
	}

	/**
	 * Set the named local variable on the identified control to the supplied
	 * value.
	 * Returns false if the variable could not be written to.
	 */
	setLocalVariable(localVariable: LocalVariable, value: JsonValue | undefined): boolean {
		const controlAndVariable = this.#getControlAndVariable(localVariable)
		if (!controlAndVariable) return false

		// Inside a custom action, the value is only for the run
		if (localVariable.frame) {
			localVariable.frame.localValues.set(localVariable.name, value)
			return true
		}

		const { entities, variableEntity } = controlAndVariable
		entities.entitySetVariableValue(LocalVariablesList, variableEntity.id, value)

		return true
	}

	/**
	 * Reset the named local variable on the identified control to its startup
	 * value.
	 * Returns false if the variable could not be written to.
	 */
	resetLocalVariable(localVariable: LocalVariable): boolean {
		const controlAndVariable = this.#getControlAndVariable(localVariable)
		if (!controlAndVariable) return false

		// Inside a custom action, a variable which has not been set in the run has its startup value
		if (localVariable.frame) {
			localVariable.frame.localValues.delete(localVariable.name)
			return true
		}

		const { entities, variableEntity } = controlAndVariable

		// This isn't allowed to be an expression
		const startupValue = variableEntity.rawOptions.startup_value?.value
		entities.entitySetVariableValue(LocalVariablesList, variableEntity.id, startupValue)

		return true
	}

	/**
	 * Set the startup value of the named local variable on the identified control
	 * from its current value.
	 * Returns false if the variable could not be written to.
	 */
	writeLocalVariableStartupValue(localVariable: LocalVariable): boolean {
		// A run of a custom action can't change the custom action itself
		if (localVariable.frame) return false

		const controlAndVariable = this.#getEditableControlAndVariable(localVariable)
		if (!controlAndVariable) return false

		const { entities, variableEntity } = controlAndVariable

		entities.entitySetOption(LocalVariablesList, variableEntity.id, 'startup_value', {
			isExpression: false,
			value: variableEntity.feedbackValue,
		})

		return true
	}
}
