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

import type { SomeSocketEntityLocation } from '@companion-app/shared/Model/EntityModel.js'
import { stringifyVariableValue } from '@companion-app/shared/Model/Variables.js'
import type { JsonValue } from '@companion-module/host'
import { isInternalUserValueFeedback, type ControlEntityInstance } from '../Controls/Entities/EntityInstance.js'
import type { ControlWithEntities } from '../Controls/IControlFragments.js'
import type { IControlStore } from '../Controls/IControlStore.js'
import type { RunActionExtras } from '../Instance/Connection/ChildHandlerApi.js'
import { ParseLocationString } from '../Internal/Util.js'
import type { IPageStore } from '../Page/Store.js'

const LocalVariablesList = 'local-variables' satisfies SomeSocketEntityLocation

export type LocalVariable = {
	readonly controlId: string
	readonly name: string
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
	}: LocalVariable): { control: ControlWithEntities; variableEntity: ControlEntityInstance } | null {
		const control = this.#controlsStore.getControl(controlId)
		if (!control || !control.supportsEntities) return null

		const variableEntity = control.entities.getAllEntities().find((ent) => ent.rawLocalVariableName === name)
		if (!variableEntity) return null

		const localVariableName = variableEntity.localVariableName
		if (!localVariableName) return null

		if (!isInternalUserValueFeedback(variableEntity)) return null

		return { control, variableEntity }
	}

	/**
	 * Get a descriptor for the local variable identified by the provided
	 * location/name.  The location may contain special syntax like `this` and so
	 * on.
	 */
	localVariableFor(
		location: JsonValue | undefined,
		name: JsonValue | undefined,
		extras: RunActionExtras
	): LocalVariable | null {
		if (!name) return null

		// eslint-disable-next-line @typescript-eslint/no-base-to-string
		name = String(name)

		const locationStr = stringifyVariableValue(location)
		if (!locationStr) return null

		if (locationStr?.trim().toLocaleLowerCase() === 'this') {
			// This could be any type of control (button, trigger, etc)
			return { controlId: extras.controlId, name }
		}

		// Parse the location of a button
		const controlLocation = ParseLocationString(locationStr, extras.location)
		if (!controlLocation) return null

		const controlId = this.#pageStore.getControlIdAt(controlLocation)
		if (!controlId) return null

		return { controlId, name }
	}

	/**
	 * Set the named local variable on the identified control to the supplied
	 * value.
	 */
	setLocalVariable(localVariable: LocalVariable, value: JsonValue | undefined): void {
		const controlAndVariable = this.#getControlAndVariable(localVariable)
		if (!controlAndVariable) return

		const { control, variableEntity } = controlAndVariable
		control.entities.entitySetVariableValue(LocalVariablesList, variableEntity.id, value)
	}

	/**
	 * Reset the named local variable on the identified control to its startup
	 * value.
	 */
	resetLocalVariable(localVariable: LocalVariable): void {
		const controlAndVariable = this.#getControlAndVariable(localVariable)
		if (!controlAndVariable) return

		const { control, variableEntity } = controlAndVariable

		// This isn't allowed to be an expression
		const startupValue = variableEntity.rawOptions.startup_value?.value
		control.entities.entitySetVariableValue(LocalVariablesList, variableEntity.id, startupValue)
	}

	/**
	 * Set the startup value of the named local variable on the identified control
	 * from its current value.
	 */
	writeLocalVariableStartupValue(localVariable: LocalVariable): void {
		const controlAndVariable = this.#getControlAndVariable(localVariable)
		if (!controlAndVariable) return

		const { control, variableEntity } = controlAndVariable

		control.entities.entitySetOption(
			LocalVariablesList,
			variableEntity.id,
			'startup_value',
			variableEntity.feedbackValue
		)
	}
}
