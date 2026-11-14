import isEqual from 'fast-deep-equal'
import { nanoid } from 'nanoid'
import type { JsonValue } from 'type-fest'
import { CreateCustomActionControlId, type CustomActionControlId } from '@companion-app/shared/ControlId.js'
import type { CustomActionRunInfo } from '@companion-app/shared/Model/CustomActionModel.js'
import { isCustomActionCall, isCustomFeedbackUse } from '@companion-app/shared/Model/EntityModel.js'
import type { CompanionOptionValues } from '@companion-module/base'
import type { RunActionExtras } from '../../Instance/Connection/ChildHandlerApi.js'
import LogController from '../../Log/Controller.js'
import type { VariableDependencyRegistry } from '../../Variables/DependencyRegistry.js'
import type { VariablesAndExpressionParser } from '../../Variables/VariablesAndExpressionParser.js'
import { ControlCustomAction, type CustomActionRunExtras } from '../ControlTypes/CustomAction.js'
import type { CustomActionRunFrame, CustomActionValues } from '../CustomActionRunFrame.js'
import {
	CustomEntityInstanceManager,
	isCustomCopyRecursive,
	type CustomEntityCallerState,
} from '../CustomEntities/CustomEntityInstanceManager.js'
import type { CustomFeedbackInstanceManager } from '../CustomFeedbacks/CustomFeedbackInstanceManager.js'
import type { ControlEntityInstance } from '../Entities/EntityInstance.js'
import { resolveStoreResult } from '../Entities/EntitySpecialExpressionManager.js'
import type { StoreResult } from '../Entities/Types.js'
import type { IControlStore } from '../IControlStore.js'
import type { RenderClock } from '../RenderClock.js'
import { CustomActionCopy } from './CustomActionCopy.js'

/** The key of the copy of a custom action held by an action which calls it, while it waits to be run */
export const CUSTOM_ACTION_HELD_COPY = 'custom-action'

export type CustomActionInstancesForEntity = Pick<CustomActionInstanceManager, 'entityUpdate' | 'entityDelete'>

/**
 * A run of a custom action which is in progress
 */
interface ActiveRun extends CustomActionRunInfo {
	readonly customActionControlId: CustomActionControlId
	/** The id of the action which called it, as it is stored */
	readonly useEntityId: string
	readonly abortController: AbortController
}

/**
 * The id of an action calling a custom action, as it is stored. The copies of a custom action, and of those it calls,
 * prefix the ids of the entities they copy, so a copy of a stored action ends with its id
 */
function getUseEntityId(callerId: string): string {
	return callerId.slice(callerId.lastIndexOf('/') + 1)
}

/**
 * Every action which calls a custom action holds a copy of the custom action's actions and local variables.
 * The copy is subscribed with the inputs given by that action, so that the feedbacks and actions of the custom action
 * can depend on its inputs, and have their values ready before the custom action is run.
 *
 * Each run of the custom action uses a further copy of its own, with the inputs as they were when it started and its
 * own local variables, so that nothing changes underneath the run. This starts with the values of the copy held by
 * the calling action.
 */
export class CustomActionInstanceManager extends CustomEntityInstanceManager<
	CustomActionControlId,
	ControlCustomAction,
	CustomActionValues,
	CustomActionCopy
> {
	readonly #controlStore: Pick<IControlStore, 'getControl'>
	readonly #renderClock: RenderClock
	/** For any copies of custom feedbacks inside the copies */
	readonly #customFeedbackInstances: CustomFeedbackInstanceManager

	/** The runs in progress, by their id */
	readonly #runs = new Map<string, ActiveRun>()

	constructor(
		controlStore: Pick<IControlStore, 'getControl'>,
		renderClock: RenderClock,
		variableDependencies: VariableDependencyRegistry,
		customFeedbackInstances: CustomFeedbackInstanceManager
	) {
		super(
			LogController.createLogger('Controls/CustomActions/InstanceManager'),
			variableDependencies,
			'custom action',
			CUSTOM_ACTION_HELD_COPY
		)
		this.#controlStore = controlStore
		this.#renderClock = renderClock
		this.#customFeedbackInstances = customFeedbackInstances
	}

	protected toCustomControlId(definitionId: string): CustomActionControlId {
		return CreateCustomActionControlId(definitionId)
	}

	protected getCustomControl(customControlId: CustomActionControlId): ControlCustomAction | undefined {
		const control = this.#controlStore.getControl(customControlId)
		return control instanceof ControlCustomAction ? control : undefined
	}

	protected createHeldCopy(
		customAction: ControlCustomAction,
		caller: ControlEntityInstance,
		state: CustomEntityCallerState<CustomActionControlId, CustomActionCopy>,
		chain: ReadonlyArray<string>,
		inputValues: CompanionOptionValues
	): CustomActionCopy {
		return new CustomActionCopy(
			customAction,
			caller,
			state.controlId,
			`${caller.id}/`,
			chain,
			this,
			this.#customFeedbackInstances,
			this.#renderClock,
			this.variableDependencies,
			{ customActionControlId: customAction.controlId, inputValues, localValues: new Map() }
		)
	}

	protected copyNestedRuntimeValues(target: ControlEntityInstance, source: ControlEntityInstance): void {
		if (isCustomFeedbackUse(target)) this.#customFeedbackInstances.copyRuntimeValues(target, source)
		else if (isCustomActionCall(target)) this.copyRuntimeValues(target, source)
	}

	protected callerChanged(): void {
		// A calling action has no value, and its copy is only read when it is run
	}

	/**
	 * A custom action has been changed or deleted, so its copies need rebuilding
	 * @param customActionControlId The control id of the custom action
	 */
	onCustomActionChanged(customActionControlId: CustomActionControlId): void {
		this.customControlChanged(customActionControlId)
	}

	/**
	 * The runs of a custom action which are in progress
	 * @param customActionControlId The custom action
	 * @returns Each run, with the id of the action which called it as it is stored
	 */
	getRuns(customActionControlId: CustomActionControlId): Array<{ run: CustomActionRunInfo; useEntityId: string }> {
		const runs: Array<{ run: CustomActionRunInfo; useEntityId: string }> = []
		for (const run of this.#runs.values()) {
			if (run.customActionControlId !== customActionControlId) continue
			runs.push({
				run: { runId: run.runId, controlId: run.controlId, startedAt: run.startedAt },
				useEntityId: run.useEntityId,
			})
		}
		return runs
	}

	/**
	 * Abort the runs of a custom action which are in progress
	 * @param customActionControlId The custom action
	 * @param useEntityId Only the runs called by this action, as it is stored, or null for every run
	 * @returns How many runs were aborted
	 */
	abortRuns(customActionControlId: CustomActionControlId, useEntityId: string | null): number {
		let count = 0
		for (const run of this.#runs.values()) {
			if (run.customActionControlId !== customActionControlId) continue
			if (useEntityId !== null && run.useEntityId !== useEntityId) continue

			run.abortController.abort()
			count++
		}
		return count
	}

	/**
	 * Run the custom action called by an action, using a copy of it for just this run
	 * @param caller The action which calls a custom action
	 * @param parser A parser in the execution context of the caller, for its inputs
	 * @param extras The execution context of the caller
	 * @param storeOutput Writes an output of the custom action where the caller chose
	 * @param runActions Runs the actions of the copy, as the actions of a control are run
	 * @returns The result of the custom action
	 */
	async runCall(
		caller: ControlEntityInstance,
		parser: VariablesAndExpressionParser,
		extras: RunActionExtras,
		storeOutput: (target: StoreResult, value: JsonValue | undefined) => void,
		runActions: (actions: ControlEntityInstance[], extras: CustomActionRunExtras) => Promise<void>
	): Promise<undefined> {
		const state = this.getCallerState(caller)
		if (!state) {
			this.logger.silly(`Not running custom action "${caller.definitionId}", as its caller is not known`)
			return undefined
		}

		// Not the copy held by the caller, as its inputs are parsed outside of any execution, so may be invalid where
		// they are not when run (eg using $(this:delta))
		const customActionControlId = CreateCustomActionControlId(caller.definitionId)
		const customAction = this.#controlStore.getControl(customActionControlId)
		if (!(customAction instanceof ControlCustomAction)) return undefined

		const chain = state.callerScope.customActionChain
		if (isCustomCopyRecursive(chain, customActionControlId)) {
			this.logger.silly(`Not running custom action "${caller.definitionId}", as it would loop or nest too deeply`)
			return undefined
		}

		// The inputs are fixed for the run, in the execution context of the caller
		const parseRes = customAction.parseCallInputs(caller.rawOptions, parser, state.controlId)
		if (!parseRes.ok) {
			this.logger.warn(
				`Failed to parse the inputs of custom action "${customAction.options.name}" in ${state.controlId}: ${JSON.stringify(parseRes.optionErrors)}`
			)
			throw new Error(
				`Failed to parse the inputs of custom action "${customAction.options.name}". One or more inputs were invalid\nErrors: ${JSON.stringify(parseRes.optionErrors)}`
			)
		}
		const inputValues = parseRes.inputValues

		const runId = nanoid()

		// A run can be aborted on its own, as well as with its caller
		const abortController = new AbortController()
		const runExtras: RunActionExtras = {
			...extras,
			abortDelayed: AbortSignal.any([extras.abortDelayed, abortController.signal]),
			// Force the executionMode to match how other action lists behave
			executionMode: 'concurrent',
		}

		const copyKey = `custom-action-run:${runId}`

		this.#runs.set(runId, {
			runId,
			controlId: state.controlId,
			startedAt: Date.now(),
			customActionControlId: customAction.controlId,
			useEntityId: getUseEntityId(caller.id),
			abortController,
		})
		this.events.emit('usageChanged')

		let runCopy: CustomActionCopy | undefined
		try {
			// Built inside the try, so that the run is forgotten again if building it fails
			const copy = new CustomActionCopy(
				customAction,
				caller,
				state.controlId,
				`${caller.id}@${runId}/`,
				[...chain, customActionControlId],
				this,
				this.#customFeedbackInstances,
				this.#renderClock,
				this.variableDependencies,
				{ customActionControlId: customAction.controlId, inputValues, localValues: new Map() }
			)
			runCopy = copy
			caller.setTransientCopy(copyKey, copy)

			// When the run sees what the copy held by the caller sees, it can start with its values
			if (state.heldCopy && isEqual(inputValues, state.heldCopy.values.inputValues)) {
				this.copyRuntimeValuesBetween(copy, `${caller.id}@${runId}/`, state.heldCopy, `${caller.id}/`)
			}

			// Where each local variable of the run is written as an output, resolved in the context of the caller
			const outputTargets = new Map<string, StoreResult[]>()
			for (const output of customAction.outputs) {
				if (!output.variableName) continue
				const rawTarget = Object.hasOwn(caller.rawOutputTargets, output.variableName)
					? caller.rawOutputTargets[output.variableName]
					: undefined
				const target = resolveStoreResult(rawTarget, parser, this.logger)
				if (!target) continue

				const targets = outputTargets.get(output.variableName) ?? []
				targets.push(target)
				outputTargets.set(output.variableName, targets)
			}

			const writeOutput = (variableName: string) => {
				const targets = outputTargets.get(variableName)
				// Once aborted the caller has moved on, so must not see anything the run does after
				if (!targets || runExtras.abortDelayed.aborted) return

				// An output is a user value, so it is what the run has set it to, or else its startup value
				const value = frame.localValues.has(variableName)
					? frame.localValues.get(variableName)
					: copy.localVariables.getDirectEntities().find((entity) => entity.rawLocalVariableName === variableName)
							?.feedbackValue
				for (const target of targets) storeOutput(target, value)
			}

			const frame: CustomActionRunFrame = {
				...copy.values,
				getLocalVariableEntities: () => copy.localVariables.getDirectEntities(),
				localValueChanged: (name) => {
					copy.localValueChanged(name)
					// Outputs are written as they change, so that the caller can see the progress of a run
					writeOutput(name)
				},
			}

			// The caller sees where each output starts, then each change as the run sets it
			for (const variableName of outputTargets.keys()) writeOutput(variableName)

			await runActions(copy.actions.getDirectEntities(), { ...runExtras, frame })

			return undefined
		} finally {
			this.#runs.delete(runId)
			this.events.emit('usageChanged')

			caller.removeTransientCopy(copyKey)
			runCopy?.destroy()
		}
	}
}
