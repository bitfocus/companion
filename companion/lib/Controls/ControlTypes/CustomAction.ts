import type z from 'zod'
import { isCustomActionsConnectionId } from '@companion-app/shared/ConnectionId.js'
import type { CustomActionControlId, SomeControlId } from '@companion-app/shared/ControlId.js'
import { diffObject } from '@companion-app/shared/Diff.js'
import type { ControlLocation } from '@companion-app/shared/Model/Common.js'
import {
	CustomActionOptionsSchema,
	CustomActionOutputSchema,
	type ClientCustomActionData,
	type CustomActionModel,
	type CustomActionOptions,
	type CustomActionOutput,
	type CustomActionRuntimeProps,
} from '@companion-app/shared/Model/CustomActionModel.js'
import type { ClientEntityDefinition } from '@companion-app/shared/Model/EntityDefinitionModel.js'
import { EntityModelType } from '@companion-app/shared/Model/EntityModel.js'
import {
	AuthorableInputFieldSchema,
	toCompanionInputField,
	type AuthorableInputField,
	type ExpressionableOptionsObject,
} from '@companion-app/shared/Model/Options.js'
import type { VariableValues } from '@companion-app/shared/Model/Variables.js'
import type { KeyValueChange } from '@companion-app/shared/Util/KeyValue.js'
import type { CompanionOptionValues } from '@companion-module/base'
import type { RunActionExtras } from '../../Instance/Connection/ChildHandlerApi.js'
import { VisitorReferencesCollector } from '../../Resources/Visitors/ReferencesCollector.js'
import { VisitorReferencesUpdater } from '../../Resources/Visitors/ReferencesUpdater.js'
import { VisitorVariableRenamer } from '../../Resources/Visitors/VariableRenamer.js'
import type {
	ExpressionParserOptions,
	VariablesAndExpressionParser,
} from '../../Variables/VariablesAndExpressionParser.js'
import { ControlActionRunner } from '../ActionRunner.js'
import { ControlBase } from '../ControlBase.js'
import type { ControlDependencies } from '../ControlDependencies.js'
import {
	buildCustomActionInputVariables,
	type CustomActionRunFrame,
	type CustomActionValues,
} from '../CustomActionRunFrame.js'
import type { CustomActionCallAnalysis } from '../CustomActions/CustomActionCalls.js'
import { isInternalUserValueFeedback, type ControlEntityInstance } from '../Entities/EntityInstance.js'
import type { ControlEntityListChangeProps } from '../Entities/EntityListPoolBase.js'
import { ControlEntityListPoolCustomAction } from '../Entities/EntityListPoolCustomAction.js'
import type {
	ControlWithActions,
	ControlWithEntities,
	ControlWithOptions,
	ControlWithoutActionSets,
	ControlWithoutEvents,
	ControlWithoutLayeredStyle,
	ControlWithoutPushed,
} from '../IControlFragments.js'
import { parseOptionsField } from '../OptionsField.js'

/**
 * Run extras which are part of a run of a custom action
 */
export type CustomActionRunExtras = RunActionExtras & { frame: CustomActionRunFrame }

/**
 * Class for a custom action: a user defined list of actions, with user defined inputs, which is offered as an action
 * of its own.
 *
 * @author Julian Waller <me@julusian.co.uk>
 * @copyright 2026 Bitfocus AS
 * @license
 * This program is free software.
 * You should have received a copy of the MIT licence as well as the Bitfocus
 * Individual Contributor License Agreement for Companion along with
 * this program.
 */
export class ControlCustomAction
	extends ControlBase<CustomActionControlId, CustomActionModel, CustomActionRuntimeProps>
	implements
		ControlWithActions,
		ControlWithoutEvents,
		ControlWithEntities,
		ControlWithoutLayeredStyle,
		ControlWithoutActionSets,
		ControlWithOptions<CustomActionOptions>,
		ControlWithoutPushed
{
	readonly type = 'custom-action'

	readonly supportsActions = true
	readonly supportsConvert = false
	readonly supportsEvents = false
	readonly supportsEntities = true
	readonly supportsLayeredStyle = false
	readonly supportsActionSets = false
	readonly supportsOptions = true
	readonly supportsPushed = false

	readonly optionsSchema: z.ZodType<CustomActionOptions> = CustomActionOptionsSchema

	/**
	 * The last sent custom action json object
	 */
	#lastSentClientJson: ClientCustomActionData | null = null

	/**
	 * Runs started from the editor, to test the custom action
	 */
	readonly #testActionRunner: ControlActionRunner

	/**
	 * Basic configuration
	 */
	options: CustomActionOptions

	/**
	 * The inputs of the custom action
	 */
	#inputs: AuthorableInputField[] = []

	/**
	 * The label of each local variable which is an output, by the id of the variable, so that renaming it keeps it
	 */
	#outputLabels = new Map<string, string>()

	/**
	 * What it calls through the other custom actions, and why some of those calls can't run, if they can't
	 */
	#callAnalysis: { analysis: CustomActionCallAnalysis; problem: string | null } | null = null

	readonly entities: ControlEntityListPoolCustomAction

	get inputs(): ReadonlyArray<AuthorableInputField> {
		return this.#inputs
	}

	/**
	 * The outputs, in the order of their local variables. Only a user value can be an output, as only that is set
	 * during a run
	 */
	get outputs(): CustomActionOutput[] {
		return this.entities.getLocalVariableEntities().flatMap((entity) => {
			const variableName = entity.rawLocalVariableName
			const label = this.#outputLabels.get(entity.id)
			if (!variableName || label === undefined || !isInternalUserValueFeedback(entity)) return []
			return [{ variableName, label }]
		})
	}

	/**
	 * @param deps - the control dependencies
	 * @param controlId - id of the control
	 * @param storage - persisted storage object
	 * @param isImport - if this is importing a custom action, not creating at startup
	 */
	constructor(
		deps: ControlDependencies,
		controlId: CustomActionControlId,
		storage: CustomActionModel | null,
		isImport: boolean
	) {
		super(deps, controlId, `Controls/ControlTypes/CustomAction/${controlId}`)

		this.#testActionRunner = new ControlActionRunner(deps.actionRunner, this.controlId, () =>
			this.sendRuntimePropsChange()
		)

		this.entities = new ControlEntityListPoolCustomAction({
			controlId,
			reportChange: this.#entityListReportChange.bind(this),
			instanceDefinitions: deps.instance.definitions,
			internalModule: deps.internalModule,
			processManager: deps.instance.processManager,
			variableValues: deps.variableValues,
			pageStore: deps.pageStore,
			renderClock: deps.renderClock,
			variableDependencies: deps.variableDependencies,
			getPageVariableEntities: deps.getPageVariableEntities,
			customActionInstances: deps.customActionInstances,
			getDefaultInputVariables: () => buildCustomActionInputVariables(this.#getDefaultInputValues()),
			localVariableRenamed: (fromName, toName) => this.#localVariableRenamed(fromName, toName),
		})

		this.options = this.optionsSchema.parse({})

		if (!storage) {
			// New control

			// Save the change
			this.commitChange()
		} else {
			if (storage.type !== 'custom-action')
				throw new Error(`Invalid type given to ControlCustomAction: "${storage.type}"`)

			this.options = { ...this.options, ...storage.options }
			// The inputs are checked by the schema of the custom action when it is loaded
			this.#inputs = storage.inputs
			this.entities.loadStorage(storage, isImport)
			for (const output of storage.outputs) {
				const variable = this.#findLocalVariable(output.variableName)
				if (variable) this.#outputLabels.set(variable.id, output.label)
			}

			// An import is saved by postProcessImport, once it has been stored
			if (!isImport) this.commitChange()
		}
	}

	#entityListReportChange(options: ControlEntityListChangeProps): void {
		// Forget the outputs of local variables which have gone
		const variableIds = new Set(this.entities.getLocalVariableEntities().map((entity) => entity.id))
		for (const variableId of this.#outputLabels.keys()) {
			if (!variableIds.has(variableId)) this.#outputLabels.delete(variableId)
		}

		if (!options.noSave) {
			this.commitChange(false)
		}
	}

	abortDelayedActions(_skip_up: boolean, exceptSignal: AbortSignal | null): void {
		this.#testActionRunner.abortAll(exceptSignal)
	}

	abortDelayedActionsSingle(_skip_up: boolean, exceptSignal: AbortSignal): void {
		this.#testActionRunner.abortSingle(exceptSignal)
	}

	checkCollectionIdIsValid(validCollectionIds: ReadonlySet<string>): boolean {
		if (this.options.collectionId && !validCollectionIds.has(this.options.collectionId)) {
			// collectionId is not valid, remove it
			this.options.collectionId = undefined

			this.commitChange(false)

			return true
		}

		return false
	}

	/**
	 * The values of the inputs when they have not been given
	 */
	#getDefaultInputValues(): VariableValues {
		const values: VariableValues = {}
		for (const input of this.#inputs) {
			values[input.id] = 'default' in input ? structuredClone(input.default) : undefined
		}
		return values
	}

	/**
	 * The definition of the action which runs this custom action
	 */
	toActionDefinition(): ClientEntityDefinition {
		return {
			entityType: EntityModelType.Action,
			label: this.options.name || 'Custom action',
			sortKey: null,
			description: this.options.description || undefined,
			options: this.#inputs.map((input) => toCompanionInputField(structuredClone(input))),
			optionsToMonitorForInvalidations: null,
			feedbackType: null,
			feedbackStyle: undefined,
			feedbackDisableStyleOverrides: false,
			feedbackStyleOverridesUnsupported: false,
			hasLifecycleFunctions: false,
			hasLearn: false,
			learnTimeout: undefined,
			showInvert: false,
			actionHasResult: false,
			actionExecutionTimeout: undefined,
			actionOutputs: this.outputs.map((output) => ({
				id: output.variableName,
				label: output.label || output.variableName,
			})),
			warning: this.#callAnalysis?.problem ?? null,
			feedbackAffectedProperties: undefined,
			optionsSupportExpressions: true,
			showButtonPreview: false,
			supportsChildGroups: [],
		}
	}

	/**
	 * Parse the options of an action which calls this custom action into the values of the inputs.
	 * An input which is missing or has an invalid value gets its default value, so that a change to the inputs of
	 * the custom action doesn't stop the actions using it from running
	 * @param rawOptions The options of the calling action
	 * @param parser A parser in the context of the caller
	 * @param callerControlId The control holding the calling action, if there is one
	 */
	parseCallInputs(
		rawOptions: ExpressionableOptionsObject,
		parser: VariablesAndExpressionParser,
		callerControlId: SomeControlId | null
	):
		| { ok: true; inputValues: CompanionOptionValues; referencedVariableIds: ReadonlySet<string> }
		| { ok: false; optionErrors: Record<string, string | undefined>; referencedVariableIds: ReadonlySet<string> } {
		const optionsWithDefaults: ExpressionableOptionsObject = { ...rawOptions }
		for (const input of this.#inputs) {
			if (optionsWithDefaults[input.id] === undefined && 'default' in input) {
				optionsWithDefaults[input.id] = { isExpression: false, value: input.default }
			}
		}

		// Invalid inputs are refused, as the options of a module action are
		const parseRes = parser.parseEntityOptions(this.toActionDefinition(), optionsWithDefaults, callerControlId)
		return parseRes.ok
			? { ok: true, inputValues: parseRes.parsedOptions, referencedVariableIds: parseRes.referencedVariableIds }
			: { ok: false, optionErrors: parseRes.optionErrors, referencedVariableIds: parseRes.referencedVariableIds }
	}

	/**
	 * Run the custom action from the editor, with the default values for its inputs
	 */
	testRun(): void {
		this.logger.debug(`Test run ${this.options.name}`)

		const frame: CustomActionRunFrame = {
			customActionControlId: this.controlId,
			inputValues: this.#getDefaultInputValues(),
			localValues: new Map(),
			getLocalVariableEntities: () => this.entities.getLocalVariableEntities(),
			// The entities of the custom action itself are not specific to a run
			localValueChanged: () => {},
		}

		this.#testActionRunner
			.runChain(
				{ surfaceId: this.controlId, location: undefined, rotationDelta: null, frame: null },
				async (extras) => {
					await this.deps.actionRunner.runMultipleActions(
						this.entities.getActionEntities(),
						{ ...extras, frame },
						extras.executionMode === 'sequential'
					)
				}
			)
			.catch((e) => {
				this.logger.error(`Failed to run actions: ${e.message}`)
			})
	}

	/**
	 * A parser for the entities of a copy of this custom action: one held by an action which calls it, or one made for
	 * a run. The `options:*` and `local:*` variables are those of the copy, and the `this:*` and `page:*` variables
	 * those of the caller, where it is now
	 * @param values The inputs and local variable values of the copy
	 * @param localVariableEntities The local variables of the copy
	 * @param callerControlId The control holding the caller, if there is one
	 * @param fallbackLocation Where the caller is when its control isn't on a page, such as where a run was started
	 * @param overrideVariableValues Any additional variables, such as those of an action being executed
	 * @param options Options for the parser
	 */
	createCopyParser(
		values: CustomActionValues,
		localVariableEntities: ControlEntityInstance[],
		callerControlId: SomeControlId | null,
		fallbackLocation: ControlLocation | null,
		overrideVariableValues: VariableValues | null,
		options: ExpressionParserOptions
	): VariablesAndExpressionParser {
		// Where the caller is now, as it may have moved, as the actions of a button would see
		const location =
			(callerControlId ? this.deps.pageStore.getLocationOfControlId(callerControlId) : undefined) ?? fallbackLocation
		const pageEntities = location ? this.deps.getPageVariableEntities(location.pageNumber) : null

		return this.entities.createCopyParser(
			values,
			localVariableEntities,
			location,
			pageEntities,
			{ ...buildCustomActionInputVariables(values.inputValues), ...overrideVariableValues },
			options
		)
	}

	/**
	 * Add an input
	 */
	inputAdd(field: AuthorableInputField): boolean {
		if (!AuthorableInputFieldSchema.safeParse(field).success) return false
		if (this.#inputs.some((input) => input.id === field.id)) return false

		this.#inputs.push(structuredClone(field))

		this.commitChange()
		return true
	}

	/**
	 * Remove an input
	 */
	inputRemove(inputId: string): boolean {
		const index = this.#inputs.findIndex((input) => input.id === inputId)
		if (index === -1) return false

		this.#inputs.splice(index, 1)

		this.commitChange()
		return true
	}

	/**
	 * Move an input to a new position in the list
	 * @param inputId The id of the input
	 * @param target The index to move it to
	 */
	inputMove(inputId: string, target: number): boolean {
		const index = this.#inputs.findIndex((input) => input.id === inputId)
		if (index === -1 || target < 0 || target >= this.#inputs.length || target === index) return false

		const [input] = this.#inputs.splice(index, 1)
		this.#inputs.splice(target, 0, input)

		this.commitChange()
		return true
	}

	/**
	 * Replace an input. If the new input has a different id, the references to it in the actions of this custom
	 * action are updated. The caller is responsible for updating the actions which call this custom action
	 * @returns Whether the input was updated
	 */
	inputUpdate(inputId: string, field: AuthorableInputField): boolean {
		if (!AuthorableInputFieldSchema.safeParse(field).success) return false

		const index = this.#inputs.findIndex((input) => input.id === inputId)
		if (index === -1) return false

		if (field.id !== inputId) {
			// Renaming, so the new id must be unused
			if (this.#inputs.some((input) => input.id === field.id)) return false

			this.#renameInputReferences(inputId, field.id)
		}

		this.#inputs[index] = structuredClone(field)

		this.commitChange()
		return true
	}

	/**
	 * Make a local variable an output, change its label, or stop it being one
	 * @param variableName The name of the local variable, which must be a user value
	 * @param label The label of the output, or null for it not to be an output
	 * @returns Whether it was changed
	 */
	outputSet(variableName: string, label: string | null): boolean {
		const variable = this.#findLocalVariable(variableName)
		if (!variable) return false

		if (label === null) {
			if (!this.#outputLabels.delete(variable.id)) return false
		} else {
			if (!isInternalUserValueFeedback(variable)) return false
			if (!CustomActionOutputSchema.safeParse({ variableName, label }).success) return false

			this.#outputLabels.set(variable.id, label)
		}

		this.commitChange()
		return true
	}

	#findLocalVariable(variableName: string): ControlEntityInstance | undefined {
		return this.entities.getLocalVariableEntities().find((entity) => entity.rawLocalVariableName === variableName)
	}

	/**
	 * A local variable has been renamed
	 */
	#localVariableRenamed(fromName: string, toName: string): void {
		// Callers know an output by the name of its variable, so they follow it being renamed
		if (this.outputs.some((output) => output.variableName === toName)) {
			this.deps.events.emit('customActionOutputRenamed', this.controlId, fromName, toName)
		}
	}

	/**
	 * Update the `$(options:<id>)` references to an input in the entities of this custom action
	 */
	#renameInputReferences(fromId: string, toId: string): void {
		const changed = new VisitorVariableRenamer(this.deps.internalModule, `options:${fromId}`, `options:${toId}`)
			.visitEntityInstances(this.entities.getAllEntities())
			.recheckChangedFeedbacks()
			.hasChanges()

		// The entities were changed in place, so must be parsed again
		if (changed) this.entities.resubscribeEntities()
	}

	/**
	 * Collect the instance ids, labels, and variables referenced by this control
	 * @param foundConnectionIds - instance ids being referenced
	 * @param foundConnectionLabels - instance labels being referenced
	 * @param foundVariables - variables being referenced
	 */
	collectReferencedConnectionsAndVariables(
		foundConnectionIds: Set<string>,
		foundConnectionLabels: Set<string>,
		foundVariables: Set<string>
	): void {
		new VisitorReferencesCollector(
			this.deps.internalModule,
			foundConnectionIds,
			foundConnectionLabels,
			foundVariables,
			undefined
		).visitEntityInstances(this.entities.getAllEntities())
	}

	/**
	 * Inform the control that it has been moved, and anything relying on its location must be invalidated
	 */
	triggerLocationHasChanged(): void {
		this.entities.resubscribeEntities(EntityModelType.Feedback, 'internal')
	}

	/**
	 * Convert this control to JSON
	 * To be sent to the client and written to the db
	 */
	toJSON(): CustomActionModel {
		return {
			type: this.type,
			options: this.options,
			inputs: this.#inputs,
			actions: this.entities.getActionEntities().map((e) => e.asEntityModel(true)),
			localVariables: this.entities.getLocalVariableEntities().map((e) => e.asEntityModel(true)),
			outputs: this.outputs,
		}
	}

	toClientJSON(): ClientCustomActionData {
		const analysis = this.#callAnalysis?.analysis
		return {
			type: this.type,
			...this.options,
			calledCustomActionIds: analysis ? [...analysis.calledIds].sort() : [],
			callLoop: analysis?.loop ?? null,
			nestedTooDeep: !!analysis?.tooDeep,
		}
	}

	/**
	 * Get the ids of the custom actions this calls directly, including from within other actions
	 */
	getCalledCustomActionIds(): Set<string> {
		// A disabled call, or one inside a disabled group, doesn't run, so can't make a loop
		const ids = new Set<string>()
		for (const entity of this.entities.getAllEnabledEntities(false)) {
			if (isCustomActionsConnectionId(entity.connectionId)) ids.add(entity.definitionId)
		}
		return ids
	}

	/**
	 * Set what this calls through the other custom actions
	 * @param analysis What it calls
	 * @param problem Why some of those calls can't run, for the user, or null if they all can
	 */
	setCallAnalysis(analysis: CustomActionCallAnalysis, problem: string | null): void {
		this.#callAnalysis = { analysis, problem }

		this.#sendClientJsonChange()
	}

	/**
	 * Rename an instance for variables used in this control
	 * @param labelFrom - the old instance short name
	 * @param labelTo - the new instance short name
	 * @access public
	 */
	renameVariables(labelFrom: string, labelTo: string): void {
		// Fix up references
		const changed = new VisitorReferencesUpdater(
			this.deps.internalModule,
			{ [labelFrom]: labelTo },
			undefined,
			undefined
		)
			.visitEntityInstances(this.entities.getAllEntities())
			.recheckChangedFeedbacks()
			.hasChanges()

		// 'redraw' if needed and save changes
		this.commitChange(changed)
	}

	/**
	 * Update an option field of this control
	 */
	optionsSetField(change: KeyValueChange<CustomActionOptions>, forceSet?: boolean): boolean {
		if (!forceSet && (change.key === 'sortOrder' || change.key === 'collectionId'))
			throw new Error('sortOrder cannot be set by the client')

		const options = parseOptionsField(this.optionsSchema, this.options, change)
		if (!options) return false

		this.options = options

		this.commitChange()

		return true
	}

	toRuntimeJSON(): CustomActionRuntimeProps {
		return {
			testRunning: this.#testActionRunner.hasRunningChains,
		}
	}

	/**
	 * If this control was imported to a running system, do some data cleanup/validation
	 */
	override postProcessImport(): void {
		this.entities.resubscribeEntities()

		this.commitChange()
		this.sendRuntimePropsChange()
	}

	/**
	 * Emit a change to the client json of this control.
	 */
	#sendClientJsonChange(): void {
		const newJson = structuredClone(this.toClientJSON())

		if (this.deps.changeEvents.listenerCount('customActionChange') > 0) {
			if (this.#lastSentClientJson) {
				const patch = diffObject(this.#lastSentClientJson || {}, newJson || {})
				if (patch.length > 0) {
					this.deps.changeEvents.emit('customActionChange', this.controlId, {
						type: 'update',
						controlId: this.controlId,
						patch,
					})
				}
			} else {
				this.deps.changeEvents.emit('customActionChange', this.controlId, {
					type: 'add',
					controlId: this.controlId,
					info: newJson,
				})
			}
		}

		this.#lastSentClientJson = newJson
	}

	commitChange(redraw = true): void {
		super.commitChange(redraw)

		this.#sendClientJsonChange()

		this.deps.events.emit('customActionDefinitionChanged', this.controlId, this)
	}

	destroy(): void {
		this.#testActionRunner.abortAll(null)
		this.entities.destroy()

		super.destroy()

		this.deps.events.emit('customActionDefinitionChanged', this.controlId, null)

		if (this.deps.changeEvents.listenerCount('customActionChange') > 0) {
			this.deps.changeEvents.emit('customActionChange', this.controlId, {
				type: 'remove',
				controlId: this.controlId,
			})
		}
	}

	/**
	 * Nothing to react to, as a custom action doesn't draw or evaluate anything on its own
	 */
	protected triggerInvalidation(): void {
		// Nothing to do
	}

	get drawing(): null {
		return null // Custom actions don't draw
	}

	/**
	 * Execute a press of this control
	 */
	pressControl(_pressed: boolean, _surfaceId: string | undefined): void {
		// Nothing to do
	}
}
