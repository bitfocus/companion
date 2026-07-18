import type { PresetButtonModel } from '@companion-app/shared/Model/ButtonModel.js'
import type { SomeControlModel } from '@companion-app/shared/Model/Controls.js'
import type { ExpressionVariableModel } from '@companion-app/shared/Model/ExpressionVariableModel.js'
import type { TriggerModel } from '@companion-app/shared/Model/TriggerModel.js'
import LogController from '../Log/Controller.js'
import type { ControlDependencies } from './ControlDependencies.js'
import { ControlButtonLayered } from './ControlTypes/Button/Layered.js'
import { ControlButtonPreset } from './ControlTypes/Button/Preset.js'
import { ControlButtonPresetReference } from './ControlTypes/Button/PresetReference.js'
import { ControlExpressionVariable } from './ControlTypes/ExpressionVariable.js'
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
	 * @param controlId Id of the control
	 * @param category 'button' | 'trigger' | 'expression-variable' | 'all'
	 * @param controlObj The existing configuration of the control, or string type if it is a new control. Note: the control must be given a clone of an object
	 * @param isImport Whether this is an import, and needs additional processing
	 */
	createClassForControl(
		controlId: string,
		category: 'button' | 'trigger' | 'expression-variable' | 'all',
		controlObj: SomeControlModel | string,
		isImport: boolean
	): SomeControl<any> | null {
		const controlType = typeof controlObj === 'object' ? controlObj.type : controlObj
		const controlObj2 = typeof controlObj === 'object' ? controlObj : null
		if (category === 'all' || category === 'button') {
			if (controlObj2?.type === 'button-layered' || (controlType === 'button-layered' && !controlObj2)) {
				return new ControlButtonLayered(this.#controlDeps, controlId, controlObj2, isImport)
			} else if (controlObj2?.type === 'preset-reference') {
				return new ControlButtonPresetReference(this.#controlDeps, controlId, controlObj2, isImport)
			} else if (controlObj2?.type === 'pagenum' || (controlType === 'pagenum' && !controlObj2)) {
				return new ControlButtonPageNumber(this.#controlDeps, controlId, controlObj2, isImport)
			} else if (controlObj2?.type === 'pageup' || (controlType === 'pageup' && !controlObj2)) {
				return new ControlButtonPageUp(this.#controlDeps, controlId, controlObj2, isImport)
			} else if (controlObj2?.type === 'pagedown' || (controlType === 'pagedown' && !controlObj2)) {
				return new ControlButtonPageDown(this.#controlDeps, controlId, controlObj2, isImport)
			}
		}

		if (category === 'all' || category === 'trigger') {
			if (controlObj2?.type === 'trigger' || (controlType === 'trigger' && !controlObj2)) {
				return new ControlTrigger(this.#controlDeps, controlId, controlObj2, isImport)
			}
		}

		if (category === 'all' || category === 'expression-variable') {
			if (controlObj2?.type === 'expression-variable' || (controlType === 'expression-variable' && !controlObj2)) {
				return new ControlExpressionVariable(this.#controlDeps, controlId, controlObj2, isImport)
			}
		}

		// Unknown type
		this.#logger.warn(`Cannot create control "${controlId}" of unknown type "${controlType}"`)
		return null
	}

	createTrigger(controlId: string, storage: TriggerModel | null = null): ControlTrigger {
		return new ControlTrigger(this.#controlDeps, controlId, storage, !!storage)
	}

	createExpressionVariable(
		controlId: string,
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
