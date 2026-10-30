import type { JsonValue } from 'type-fest'
import { isCustomActionsConnectionId } from '@companion-app/shared/ConnectionId.js'
import { diffObject } from '@companion-app/shared/Diff.js'
import { BANNED_PROPS } from '@companion-app/shared/Expressions.js'
import {
	CustomActionOutputSchema,
	type ClientCustomActionData,
	type CustomActionModel,
	type CustomActionOptions,
	type CustomActionOutput,
} from '@companion-app/shared/Model/CustomActionModel.js'
import type { ClientEntityDefinition } from '@companion-app/shared/Model/EntityDefinitionModel.js'
import { EntityModelType } from '@companion-app/shared/Model/EntityModel.js'
import {
	AuthorableInputFieldSchema,
	isExpressionOrValue,
	toCompanionInputField,
	type AuthorableInputField,
	type ExpressionableOptionsObject,
} from '@companion-app/shared/Model/Options.js'
import type { VariableValues } from '@companion-app/shared/Model/Variables.js'
import type { CompanionOptionValues } from '@companion-module/base'
import type { RunActionExtras } from '../../Instance/Connection/ChildHandlerApi.js'
import { VisitorReferencesCollector } from '../../Resources/Visitors/ReferencesCollector.js'
import { VisitorReferencesUpdater } from '../../Resources/Visitors/ReferencesUpdater.js'
import { buildActionExecutionOverrides } from '../../Variables/Util.js'
import type {
	ExpressionParserOptions,
	VariablesAndExpressionParser,
} from '../../Variables/VariablesAndExpressionParser.js'
import { ControlActionRunner } from '../ActionRunner.js'
import { ControlBase } from '../ControlBase.js'
import type { ControlDependencies } from '../ControlDependencies.js'
import {
	buildCustomActionOptionsVariables,
	type CustomActionRunFrame,
	type CustomActionValues,
} from '../CustomActionRunFrame.js'
import type { CustomActionCallAnalysis } from '../CustomActions/CustomActionCalls.js'
import type { ControlEntityInstance } from '../Entities/EntityInstance.js'
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
	extends ControlBase<CustomActionModel>
	implements
		ControlWithActions,
		ControlWithoutEvents,
		ControlWithEntities,
		ControlWithoutLayeredStyle,
		ControlWithoutActionSets,
		ControlWithOptions,
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

	/**
	 * The defaults options for a custom action
	 */
	static DefaultOptions: CustomActionOptions = {
		name: 'New custom action',
		description: '',
		sortOrder: 0,
		notes: '',
	}

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
	 * The outputs of the custom action
	 */
	#outputs: CustomActionOutput[] = []

	/**
	 * What it calls through the other custom actions, and why some of those calls can't run, if they can't
	 */
	#callAnalysis: { analysis: CustomActionCallAnalysis; problem: string | null } | null = null

	readonly entities: ControlEntityListPoolCustomAction

	get inputs(): ReadonlyArray<AuthorableInputField> {
		return this.#inputs
	}

	get outputs(): ReadonlyArray<CustomActionOutput> {
		return this.#outputs
	}

	/**
	 * @param deps - the control dependencies
	 * @param controlId - id of the control
	 * @param storage - persisted storage object
	 * @param isImport - if this is importing a custom action, not creating at startup
	 */
	constructor(deps: ControlDependencies, controlId: string, storage: CustomActionModel | null, isImport: boolean) {
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
			getPageVariableEntities: deps.getPageVariableEntities,
			customActionInstances: deps.customActionInstances,
			getDefaultOptionsVariables: () => buildCustomActionOptionsVariables(this.#getDefaultOptions()),
		})

		this.options = structuredClone(ControlCustomAction.DefaultOptions)

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
			this.#outputs = storage.outputs
			this.entities.loadStorage(storage, true, isImport)

			if (isImport) setImmediate(() => this.#postProcessImport())
			else this.commitChange()
		}
	}

	#entityListReportChange(options: ControlEntityListChangeProps): void {
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
	#getDefaultOptions(): VariableValues {
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
			actionOutputs: this.#outputs.map((output) => ({ id: output.id, label: output.label })),
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
		callerControlId: string | null
	): { options: CompanionOptionValues; referencedVariableIds: ReadonlySet<string> } {
		const optionsWithDefaults: ExpressionableOptionsObject = { ...rawOptions }
		for (const input of this.#inputs) {
			if (optionsWithDefaults[input.id] === undefined && 'default' in input) {
				optionsWithDefaults[input.id] = { isExpression: false, value: input.default }
			}
		}

		const parseRes = parser.parseEntityOptions(this.toActionDefinition(), optionsWithDefaults, callerControlId)
		if (!parseRes.ok) {
			this.logger.debug(`Using defaults for invalid inputs: ${JSON.stringify(parseRes.optionErrors)}`)
		}

		return {
			options: parseRes.ok ? parseRes.parsedOptions : parseRes.parsedOptionsWithDefaults,
			referencedVariableIds: parseRes.referencedVariableIds,
		}
	}

	/**
	 * Run some actions as a run of this custom action
	 * @param actions The actions to run, which are this custom action's own or a copy of them
	 * @param frame The state of the run
	 * @param extras The execution context of the caller
	 */
	async runActions(
		actions: ControlEntityInstance[],
		frame: CustomActionRunFrame,
		extras: RunActionExtras
	): Promise<void> {
		const runExtras: CustomActionRunExtras = { ...extras, frame }

		await this.deps.actionRunner.runMultipleActions(actions, runExtras, extras.executionMode === 'sequential')
	}

	/**
	 * Run the custom action from the editor, with the default values for its inputs
	 */
	testRun(): void {
		this.logger.debug(`Test run ${this.options.name}`)

		const frame: CustomActionRunFrame = {
			customActionControlId: this.controlId,
			options: this.#getDefaultOptions(),
			localValues: new Map(),
			getLocalVariableEntities: () => this.entities.getLocalVariableEntities(),
			// The entities of the custom action itself are not specific to a run
			localValueChanged: () => {},
		}

		this.#testActionRunner
			.runChain(
				{ surfaceId: this.controlId, location: undefined, rotationDelta: null, frame: null },
				async (extras) => {
					await this.runActions(this.entities.getActionEntities(), frame, extras)
				}
			)
			.catch((e) => {
				this.logger.error(`Failed to run actions: ${e.message}`)
			})
	}

	/**
	 * Get the value of a local variable during a run
	 * @param frame The state of the run
	 * @param extras The execution context of the caller
	 * @param variableName The name of the local variable, without the `local:` prefix
	 */
	readRunLocalVariable(
		frame: CustomActionRunFrame,
		extras: RunActionExtras,
		variableName: string
	): JsonValue | undefined {
		const parser = this.createRunParser({ ...extras, frame }, { allowClockSensitive: false })
		const result = parser.executeExpression(`$(local:${variableName})`, undefined)
		return result.ok ? result.value : undefined
	}

	/**
	 * A parser for an action being executed as part of a run of this custom action
	 */
	createRunParser(extras: CustomActionRunExtras, options: ExpressionParserOptions): VariablesAndExpressionParser {
		const location = extras.location ?? null
		const pageEntities = location ? this.deps.getPageVariableEntities(location.pageNumber) : null

		return this.entities.createRunParser(
			extras.frame,
			extras.frame.getLocalVariableEntities(),
			location,
			pageEntities,
			buildActionExecutionOverrides(extras),
			options
		)
	}

	/**
	 * A parser for the entities of a copy of this custom action, held by an action which calls it
	 * @param values The inputs and local variable values of the copy
	 * @param callerControlId The control which holds the copy, which provides the `this:*` and `page:*` variables
	 * @param localVariableEntities The local variables of the copy
	 * @param overrideVariableValues Any additional variables
	 * @param options Options for the parser
	 */
	createCopyParser(
		values: CustomActionValues,
		callerControlId: string,
		localVariableEntities: ControlEntityInstance[],
		overrideVariableValues: VariableValues | null,
		options: ExpressionParserOptions
	): VariablesAndExpressionParser {
		const location = this.deps.pageStore.getLocationOfControlId(callerControlId) ?? null
		const pageEntities = location ? this.deps.getPageVariableEntities(location.pageNumber) : null

		return this.entities.createRunParser(
			values,
			localVariableEntities,
			location,
			pageEntities,
			{ ...buildCustomActionOptionsVariables(values.options), ...overrideVariableValues },
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
	 * Add an output
	 */
	outputAdd(output: CustomActionOutput): boolean {
		if (!CustomActionOutputSchema.safeParse(output).success) return false
		if (this.#outputs.some((existing) => existing.id === output.id)) return false

		this.#outputs.push(structuredClone(output))

		this.commitChange()
		return true
	}

	/**
	 * Remove an output
	 */
	outputRemove(outputId: string): boolean {
		const index = this.#outputs.findIndex((output) => output.id === outputId)
		if (index === -1) return false

		this.#outputs.splice(index, 1)

		this.commitChange()
		return true
	}

	/**
	 * Move an output to a new position in the list
	 * @param outputId The id of the output
	 * @param target The index to move it to
	 */
	outputMove(outputId: string, target: number): boolean {
		const index = this.#outputs.findIndex((output) => output.id === outputId)
		if (index === -1 || target < 0 || target >= this.#outputs.length || target === index) return false

		const [output] = this.#outputs.splice(index, 1)
		this.#outputs.splice(target, 0, output)

		this.commitChange()
		return true
	}

	/**
	 * Replace an output. The caller is responsible for updating the actions which call this custom action, if the id
	 * of the output changes
	 * @returns Whether the output was updated
	 */
	outputUpdate(outputId: string, output: CustomActionOutput): boolean {
		if (!CustomActionOutputSchema.safeParse(output).success) return false

		const index = this.#outputs.findIndex((existing) => existing.id === outputId)
		if (index === -1) return false

		// Renaming, so the new id must be unused
		if (output.id !== outputId && this.#outputs.some((existing) => existing.id === output.id)) return false

		this.#outputs[index] = structuredClone(output)

		this.commitChange()
		return true
	}

	/**
	 * Update the `$(options:<id>)` references to an input in the entities of this custom action
	 */
	#renameInputReferences(fromId: string, toId: string): void {
		const fromVariable = `$(options:${fromId})`
		const toVariable = `$(options:${toId})`

		for (const entity of this.entities.getAllEntities()) {
			let changed = false
			const newOptions: ExpressionableOptionsObject = {}

			for (const [key, value] of Object.entries(entity.rawOptions)) {
				if (isExpressionOrValue(value) && typeof value.value === 'string' && value.value.includes(fromVariable)) {
					newOptions[key] = { ...value, value: value.value.replaceAll(fromVariable, toVariable) }
					changed = true
				} else {
					newOptions[key] = value
				}
			}

			if (changed) entity.setOptions(newOptions)
		}
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
		).visitEntities(this.entities.getAllEntities(), [])
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
	 * @param clone - Whether to return a cloned object
	 */
	toJSON(clone = true): CustomActionModel {
		const obj: CustomActionModel = {
			type: this.type,
			options: this.options,
			inputs: this.#inputs,
			actions: this.entities.getActionEntities().map((e) => e.asEntityModel(true)),
			localVariables: this.entities.getLocalVariableEntities().map((e) => e.asEntityModel(true)),
			outputs: this.#outputs,
		}
		return clone ? structuredClone(obj) : obj
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
		const ids = new Set<string>()
		for (const entity of this.entities.getAllEntities()) {
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
			.visitEntities(this.entities.getAllEntities(), [])
			.recheckChangedFeedbacks()
			.hasChanges()

		// 'redraw' if needed and save changes
		this.commitChange(changed)
	}

	/**
	 * Update an option field of this control
	 */
	optionsSetField(key: string, value: JsonValue | undefined, forceSet?: boolean): boolean {
		if (!forceSet && (key === 'sortOrder' || key === 'collectionId'))
			throw new Error('sortOrder cannot be set by the client')
		if (BANNED_PROPS.has(key)) throw new Error(`Setting option "${key}" is not allowed`)

		// @ts-expect-error mismatch in types
		this.options[key] = value

		this.commitChange()

		return true
	}

	toRuntimeJSON(): Record<string, any> {
		return {
			testRunning: this.#testActionRunner.hasRunningChains,
		}
	}

	/**
	 * If this control was imported to a running system, do some data cleanup/validation
	 */
	#postProcessImport(): void {
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

		this.deps.events.emit('customActionDefinitionChanged', this.controlId)
	}

	destroy(): void {
		this.#testActionRunner.abortAll(null)
		this.entities.destroy()

		super.destroy()

		this.deps.events.emit('customActionDefinitionChanged', this.controlId)

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
