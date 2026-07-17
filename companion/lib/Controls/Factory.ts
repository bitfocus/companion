import type { EventEmitter } from 'node:events'
import type { PresetButtonModel } from '@companion-app/shared/Model/ButtonModel.js'
import type { SomeControlModel } from '@companion-app/shared/Model/Controls.js'
import type { ExpressionVariableModel } from '@companion-app/shared/Model/ExpressionVariableModel.js'
import type { TriggerModel } from '@companion-app/shared/Model/TriggerModel.js'
import LogController from '../Log/Controller.js'
import type {
	ControlChangeEvents,
	ControlCommonEvents,
	ControlDependencies,
	ControlExternalDependencies,
} from './ControlDependencies.js'
import type { ControlStore } from './ControlStore.js'
import { ControlButtonLayered } from './ControlTypes/Button/Layered.js'
import { ControlButtonPreset } from './ControlTypes/Button/Preset.js'
import { ControlButtonPresetReference } from './ControlTypes/Button/PresetReference.js'
import { ControlExpressionVariable } from './ControlTypes/ExpressionVariable.js'
import { ControlButtonPageDown } from './ControlTypes/PageDown.js'
import { ControlButtonPageNumber } from './ControlTypes/PageNumber.js'
import { ControlButtonPageUp } from './ControlTypes/PageUp.js'
import { ControlTrigger } from './ControlTypes/Triggers/Trigger.js'
import type { ExpressionVariableNameMap } from './ExpressionVariableNameMap.js'
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

	readonly #deps: ControlExternalDependencies
	readonly #store: ControlStore
	readonly #controlEvents: EventEmitter<ControlCommonEvents>
	readonly #controlChangeEvents: EventEmitter<ControlChangeEvents>
	readonly #expressionVariableNamesMap: ExpressionVariableNameMap

	constructor(
		deps: ControlExternalDependencies,
		store: ControlStore,
		controlEvents: EventEmitter<ControlCommonEvents>,
		controlChangeEvents: EventEmitter<ControlChangeEvents>,
		expressionVariableNamesMap: ExpressionVariableNameMap
	) {
		this.#deps = deps
		this.#store = store
		this.#controlEvents = controlEvents
		this.#controlChangeEvents = controlChangeEvents
		this.#expressionVariableNamesMap = expressionVariableNamesMap
	}

	#createControlDependencies(): ControlDependencies {
		return {
			...this.#deps,
			dbTable: this.#store.dbTable,
			events: this.#controlEvents,
			changeEvents: this.#controlChangeEvents,
		}
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
				return new ControlButtonLayered(this.#createControlDependencies(), controlId, controlObj2, isImport)
			} else if (controlObj2?.type === 'preset-reference') {
				return new ControlButtonPresetReference(this.#createControlDependencies(), controlId, controlObj2, isImport)
			} else if (controlObj2?.type === 'pagenum' || (controlType === 'pagenum' && !controlObj2)) {
				return new ControlButtonPageNumber(this.#createControlDependencies(), controlId, controlObj2, isImport)
			} else if (controlObj2?.type === 'pageup' || (controlType === 'pageup' && !controlObj2)) {
				return new ControlButtonPageUp(this.#createControlDependencies(), controlId, controlObj2, isImport)
			} else if (controlObj2?.type === 'pagedown' || (controlType === 'pagedown' && !controlObj2)) {
				return new ControlButtonPageDown(this.#createControlDependencies(), controlId, controlObj2, isImport)
			}
		}

		if (category === 'all' || category === 'trigger') {
			if (controlObj2?.type === 'trigger' || (controlType === 'trigger' && !controlObj2)) {
				return new ControlTrigger(
					this.#createControlDependencies(),
					this.#store.triggerEvents,
					controlId,
					controlObj2,
					isImport
				)
			}
		}

		if (category === 'all' || category === 'expression-variable') {
			if (controlObj2?.type === 'expression-variable' || (controlType === 'expression-variable' && !controlObj2)) {
				return new ControlExpressionVariable(
					this.#createControlDependencies(),
					this.#expressionVariableNamesMap,
					controlId,
					controlObj2,
					isImport
				)
			}
		}

		// Unknown type
		this.#logger.warn(`Cannot create control "${controlId}" of unknown type "${controlType}"`)
		return null
	}

	createTrigger(controlId: string, storage: TriggerModel | null = null): ControlTrigger {
		return new ControlTrigger(
			this.#createControlDependencies(),
			this.#store.triggerEvents,
			controlId,
			storage,
			!!storage
		)
	}

	createExpressionVariable(
		controlId: string,
		storage: ExpressionVariableModel | null = null
	): ControlExpressionVariable {
		return new ControlExpressionVariable(
			this.#createControlDependencies(),
			this.#expressionVariableNamesMap,
			controlId,
			storage,
			!!storage
		)
	}

	createPresetControl(
		connectionId: string,
		presetId: string,
		variablesHash: string,
		presetModel: PresetButtonModel
	): ControlButtonPreset {
		return new ControlButtonPreset(
			this.#createControlDependencies(),
			connectionId,
			presetId,
			variablesHash,
			presetModel
		)
	}
}
