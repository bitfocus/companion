import {
	isControlIdOfKind,
	type ExpressionVariableControlId,
	type SomeControlId,
	type TriggerControlId,
} from '@companion-app/shared/ControlId.js'
import type { PresetButtonModel } from '@companion-app/shared/Model/ButtonModel.js'
import type { SomeControlModel } from '@companion-app/shared/Model/Controls.js'
import type { ExpressionVariableModel } from '@companion-app/shared/Model/ExpressionVariableModel.js'
import type { TriggerModel } from '@companion-app/shared/Model/TriggerModel.js'
import LogController from '../Log/Controller.js'
import type { ControlDependencies } from './ControlDependencies.js'
import { ControlButtonLayered } from './ControlTypes/Button/Layered.js'
import { ControlButtonLink } from './ControlTypes/Button/Link.js'
import { ControlButtonPreset } from './ControlTypes/Button/Preset.js'
import { ControlButtonPresetReference } from './ControlTypes/Button/PresetReference.js'
import { ControlButtonReference } from './ControlTypes/Button/Reference.js'
import { ControlExpressionVariable } from './ControlTypes/ExpressionVariable.js'
import { ControlPage } from './ControlTypes/Page.js'
import { ControlButtonPageDown } from './ControlTypes/PageDown.js'
import { ControlButtonPageNumber } from './ControlTypes/PageNumber.js'
import { ControlButtonPageUp } from './ControlTypes/PageUp.js'
import { ControlTrigger } from './ControlTypes/Triggers/Trigger.js'
import type { SomeControl } from './IControlFragments.js'

/**
 * Constructs control class instances of the correct type.
 *
 * This is pure construction: it returns an instance and never registers it in the
 * store, emits events, or performs post-birth lifecycle wiring (collection-enable,
 * names-map registration, db commit). Those are the caller's responsibility.
 */
export class ControlsFactory {
	readonly #logger = LogController.createLogger('Controls/Factory')

	readonly #controlDeps: ControlDependencies

	constructor(controlDeps: ControlDependencies) {
		this.#controlDeps = controlDeps
	}

	/**
	 * Create a new control class instance
	 * @param controlId Id of the control. Its kind must match the type of the control
	 * @param category 'button' | 'trigger' | 'expression-variable' | 'all'
	 * @param controlObj The existing configuration of the control, or string type if it is a new control. Note: the control must be given a clone of an object
	 * @param isImport Whether this is an import, and needs additional processing
	 */
	createClassForControl(
		controlId: SomeControlId,
		category: 'button' | 'trigger' | 'expression-variable' | 'all',
		controlObj: SomeControlModel | string,
		isImport: boolean
	): SomeControl | null {
		const controlType = typeof controlObj === 'object' ? controlObj.type : controlObj
		const controlObj2 = typeof controlObj === 'object' ? controlObj : null
		if ((category === 'all' || category === 'button') && isControlIdOfKind(controlId, 'bank')) {
			if (controlObj2?.type === 'button-layered' || (controlType === 'button-layered' && !controlObj2)) {
				return new ControlButtonLayered(this.#controlDeps, controlId, controlObj2, isImport)
			} else if (controlObj2?.type === 'preset-reference') {
				return new ControlButtonPresetReference(this.#controlDeps, controlId, controlObj2, isImport)
			} else if (controlObj2?.type === 'button-reference' || (controlType === 'button-reference' && !controlObj2)) {
				return new ControlButtonReference(this.#controlDeps, controlId, controlObj2, isImport)
			} else if (controlObj2?.type === 'link-button' || (controlType === 'link-button' && !controlObj2)) {
				return new ControlButtonLink(this.#controlDeps, controlId, controlObj2, isImport)
			} else if (controlObj2?.type === 'pagenum' || (controlType === 'pagenum' && !controlObj2)) {
				return new ControlButtonPageNumber(this.#controlDeps, controlId, controlObj2, isImport)
			} else if (controlObj2?.type === 'pageup' || (controlType === 'pageup' && !controlObj2)) {
				return new ControlButtonPageUp(this.#controlDeps, controlId, controlObj2, isImport)
			} else if (controlObj2?.type === 'pagedown' || (controlType === 'pagedown' && !controlObj2)) {
				return new ControlButtonPageDown(this.#controlDeps, controlId, controlObj2, isImport)
			}
		}

		if ((category === 'all' || category === 'trigger') && isControlIdOfKind(controlId, 'trigger')) {
			if (controlObj2?.type === 'trigger' || (controlType === 'trigger' && !controlObj2)) {
				return new ControlTrigger(this.#controlDeps, controlId, controlObj2, isImport)
			}
		}

		if (
			(category === 'all' || category === 'expression-variable') &&
			isControlIdOfKind(controlId, 'expression-variable')
		) {
			if (controlObj2?.type === 'expression-variable' || (controlType === 'expression-variable' && !controlObj2)) {
				return new ControlExpressionVariable(this.#controlDeps, controlId, controlObj2, isImport)
			}
		}

		if (category === 'all' && isControlIdOfKind(controlId, 'page')) {
			if (controlObj2?.type === 'page' || (controlType === 'page' && !controlObj2)) {
				return new ControlPage(this.#controlDeps, controlId, controlObj2, isImport)
			}
		}

		// Unknown type, or one that doesn't match the kind of the id
		this.#logger.warn(`Cannot create control "${controlId}" of type "${controlType}"`)
		return null
	}

	createTrigger(controlId: TriggerControlId, storage: TriggerModel | null = null): ControlTrigger {
		return new ControlTrigger(this.#controlDeps, controlId, storage, !!storage)
	}

	createExpressionVariable(
		controlId: ExpressionVariableControlId,
		storage: ExpressionVariableModel | null = null
	): ControlExpressionVariable {
		return new ControlExpressionVariable(this.#controlDeps, controlId, storage, !!storage)
	}

	createPresetControl(
		connectionId: string,
		presetId: string,
		variablesHash: string,
		presetModel: PresetButtonModel
	): ControlButtonPreset {
		return new ControlButtonPreset(this.#controlDeps, connectionId, presetId, variablesHash, presetModel)
	}
}
