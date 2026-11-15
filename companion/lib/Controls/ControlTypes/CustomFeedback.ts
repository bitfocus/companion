import type z from 'zod'
import type { CustomFeedbackControlId, SomeControlId } from '@companion-app/shared/ControlId.js'
import { diffObject } from '@companion-app/shared/Diff.js'
import type { NoRuntimeProps } from '@companion-app/shared/Model/Controls.js'
import {
	CustomFeedbackOptionsSchema,
	type ClientCustomFeedbackData,
	type CustomFeedbackModel,
	type CustomFeedbackOptions,
} from '@companion-app/shared/Model/CustomFeedbackModel.js'
import { EntityModelType, FeedbackEntitySubType, isCustomFeedbackUse } from '@companion-app/shared/Model/EntityModel.js'
import type { ExpressionableOptionsObject } from '@companion-app/shared/Model/Options.js'
import type { VariableValues } from '@companion-app/shared/Model/Variables.js'
import type { KeyValueChange } from '@companion-app/shared/Util/KeyValue.js'
import type { CompanionOptionValues } from '@companion-module/base'
import type { FeedbackDefinition } from '../../Instance/Definitions.js'
import { VisitorReferencesCollector } from '../../Resources/Visitors/ReferencesCollector.js'
import { VisitorReferencesUpdater } from '../../Resources/Visitors/ReferencesUpdater.js'
import type {
	ExpressionParserOptions,
	VariablesAndExpressionParser,
} from '../../Variables/VariablesAndExpressionParser.js'
import { BuildingBlockInputs } from '../BuildingBlocks/BuildingBlockInputs.js'
import type { ControlPressSource } from '../ButtonPressEvents.js'
import { ControlBase } from '../ControlBase.js'
import type { ControlDependencies } from '../ControlDependencies.js'
import { buildCustomActionInputVariables } from '../CustomActionRunFrame.js'
import type { CustomActionCallAnalysis } from '../CustomActions/CustomActionCalls.js'
import type { CustomFeedbackValues } from '../CustomFeedbacks/CustomFeedbackCopy.js'
import type { ControlEntityInstance } from '../Entities/EntityInstance.js'
import type { ControlEntityListChangeProps } from '../Entities/EntityListPoolBase.js'
import { ControlEntityListPoolCustomFeedback } from '../Entities/EntityListPoolCustomFeedback.js'
import type {
	ControlWithBuildingBlockInputs,
	ControlWithEntities,
	ControlWithOptions,
	ControlWithoutActions,
	ControlWithoutActionSets,
	ControlWithoutEvents,
	ControlWithoutLayeredStyle,
	ControlWithoutPushed,
} from '../IControlFragments.js'
import { parseOptionsField } from '../OptionsField.js'

/**
 * Class for a custom feedback: a user defined list of boolean feedbacks, with user defined inputs, which is offered
 * as a boolean feedback of its own. It is true when all of its feedbacks are.
 *
 * @author Julian Waller <me@julusian.co.uk>
 * @copyright 2026 Bitfocus AS
 * @license
 * This program is free software.
 * You should have received a copy of the MIT licence as well as the Bitfocus
 * Individual Contributor License Agreement for Companion along with
 * this program.
 */
export class ControlCustomFeedback
	extends ControlBase<CustomFeedbackControlId, CustomFeedbackModel, NoRuntimeProps>
	implements
		ControlWithoutActions,
		ControlWithoutEvents,
		ControlWithEntities,
		ControlWithoutLayeredStyle,
		ControlWithoutActionSets,
		ControlWithOptions<CustomFeedbackOptions>,
		ControlWithoutPushed,
		ControlWithBuildingBlockInputs
{
	readonly type = 'custom-feedback'

	readonly supportsActions = false
	readonly supportsConvert = false
	readonly supportsEvents = false
	readonly supportsEntities = true
	readonly supportsLayeredStyle = false
	readonly supportsActionSets = false
	readonly supportsOptions = true
	readonly supportsPushed = false
	readonly supportsBuildingBlockInputs = true

	readonly optionsSchema: z.ZodType<CustomFeedbackOptions> = CustomFeedbackOptionsSchema

	/**
	 * The last sent custom feedback json object
	 */
	#lastSentClientJson: ClientCustomFeedbackData | null = null

	/**
	 * Basic configuration
	 */
	options: CustomFeedbackOptions

	/**
	 * What it uses through the other custom feedbacks, and why some of those uses can't work, if they can't
	 */
	#callAnalysis: { analysis: CustomActionCallAnalysis; problem: string | null } | null = null

	readonly buildingBlockInputs: BuildingBlockInputs

	readonly entities: ControlEntityListPoolCustomFeedback

	/**
	 * @param deps - the control dependencies
	 * @param controlId - id of the control
	 * @param storage - persisted storage object
	 * @param isImport - if this is importing a custom feedback, not creating at startup
	 */
	constructor(
		deps: ControlDependencies,
		controlId: CustomFeedbackControlId,
		storage: CustomFeedbackModel | null,
		isImport: boolean
	) {
		super(deps, controlId, `Controls/ControlTypes/CustomFeedback/${controlId}`)

		this.entities = new ControlEntityListPoolCustomFeedback({
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
			customFeedbackInstances: deps.customFeedbackInstances,
			getDefaultInputVariables: () => buildCustomActionInputVariables(this.buildingBlockInputs.getDefaultValues()),
		})

		this.buildingBlockInputs = new BuildingBlockInputs(deps.internalModule, this.entities, () => this.commitChange())

		this.options = this.optionsSchema.parse({})

		if (storage) {
			if (storage.type !== 'custom-feedback')
				throw new Error(`Invalid type given to ControlCustomFeedback: "${storage.type}"`)

			this.options = { ...this.options, ...storage.options }
			this.buildingBlockInputs.loadStorage(storage.inputs)
			this.entities.loadStorage(storage, isImport)
		}
	}

	#entityListReportChange(options: ControlEntityListChangeProps): void {
		if (!options.noSave) {
			this.commitChange(false)
		}
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
	 * The definition of the feedback which uses this custom feedback
	 */
	toFeedbackDefinition(): FeedbackDefinition {
		return {
			entityType: EntityModelType.Feedback,
			label: this.options.name || 'Custom feedback',
			sortKey: null,
			description: this.options.description || null,
			options: this.buildingBlockInputs.toCompanionInputFields(),
			feedbackType: FeedbackEntitySubType.Boolean,
			feedbackStyle: undefined,
			feedbackDisableStyleOverrides: false,
			feedbackStyleOverridesUnsupported: false,
			hasLearn: false,
			learnTimeout: undefined,
			showInvert: true,
			warning: this.#callAnalysis?.problem ?? null,
			feedbackAffectedProperties: undefined,
			showButtonPreview: false,
			supportsChildGroups: [],
		}
	}

	/**
	 * Parse the options of a feedback which uses this custom feedback into the values of the inputs.
	 * An input which is missing gets its default value, so that adding an input to the custom feedback doesn't stop
	 * the feedbacks using it from working
	 * @param rawOptions The options of the calling feedback
	 * @param parser A parser in the context of the caller
	 * @param callerControlId The control holding the calling feedback, if there is one
	 */
	parseCallInputs(
		rawOptions: ExpressionableOptionsObject,
		parser: VariablesAndExpressionParser,
		callerControlId: SomeControlId | null
	):
		| { ok: true; inputValues: CompanionOptionValues; referencedVariableIds: ReadonlySet<string> }
		| { ok: false; optionErrors: Record<string, string | undefined>; referencedVariableIds: ReadonlySet<string> } {
		const optionsWithDefaults = this.buildingBlockInputs.withDefaultOptions(rawOptions)

		// Invalid inputs are refused, as the options of a module feedback are
		const parseRes = parser.parseEntityOptions(this.toFeedbackDefinition(), optionsWithDefaults, callerControlId)
		return parseRes.ok
			? { ok: true, inputValues: parseRes.parsedOptions, referencedVariableIds: parseRes.referencedVariableIds }
			: { ok: false, optionErrors: parseRes.optionErrors, referencedVariableIds: parseRes.referencedVariableIds }
	}

	/**
	 * A parser for the entities of a copy of this custom feedback, held by a feedback which uses it. The `options:*`
	 * and `local:*` variables are those of the copy, and the `this:*` and `page:*` variables those of the caller
	 * @param values The inputs of the copy
	 * @param localVariableEntities The local variables of the copy
	 * @param callerControlId The control which holds the copy
	 * @param overrideVariableValues Any additional variables, such as those of an action being executed
	 * @param options Options for the parser
	 */
	createCopyParser(
		values: CustomFeedbackValues,
		localVariableEntities: ControlEntityInstance[],
		callerControlId: SomeControlId,
		overrideVariableValues: VariableValues | null,
		options: ExpressionParserOptions
	): VariablesAndExpressionParser {
		const location = this.deps.pageStore.getLocationOfControlId(callerControlId) ?? null
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
	toJSON(): CustomFeedbackModel {
		return {
			type: this.type,
			options: this.options,
			inputs: this.buildingBlockInputs.toJSON(),
			feedbacks: this.entities.getFeedbackEntities().map((e) => e.asEntityModel(true)),
			localVariables: this.entities.getLocalVariableEntities().map((e) => e.asEntityModel(true)),
		}
	}

	toClientJSON(): ClientCustomFeedbackData {
		const analysis = this.#callAnalysis?.analysis
		return {
			type: this.type,
			...this.options,
			calledCustomFeedbackIds: analysis ? [...analysis.calledIds].sort() : [],
			callLoop: analysis?.loop ?? null,
			nestedTooDeep: !!analysis?.tooDeep,
		}
	}

	/**
	 * Get the ids of the custom feedbacks this uses directly, including from within other feedbacks
	 */
	getCalledCustomFeedbackIds(): Set<string> {
		// A disabled use, or one inside a disabled group, isn't evaluated, so can't make a loop
		const ids = new Set<string>()
		for (const entity of this.entities.getAllEnabledEntities(false)) {
			if (isCustomFeedbackUse(entity)) ids.add(entity.definitionId)
		}
		return ids
	}

	/**
	 * Set what this uses through the other custom feedbacks
	 * @param analysis What it uses
	 * @param problem Why some of those uses can't work, for the user, or null if they all can
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
	optionsSetField(change: KeyValueChange<CustomFeedbackOptions>, forceSet?: boolean): boolean {
		if (!forceSet && (change.key === 'sortOrder' || change.key === 'collectionId'))
			throw new Error('sortOrder cannot be set by the client')

		const options = parseOptionsField(this.optionsSchema, this.options, change)
		if (!options) return false

		this.options = options

		this.commitChange()

		return true
	}

	toRuntimeJSON(): NoRuntimeProps {
		return {}
	}

	override start(save: boolean): void {
		this.entities.resubscribeEntities()

		if (save) this.commitChange()
	}

	/**
	 * Emit a change to the client json of this control.
	 */
	#sendClientJsonChange(): void {
		const newJson = structuredClone(this.toClientJSON())

		if (this.deps.changeEvents.listenerCount('customFeedbackChange') > 0) {
			if (this.#lastSentClientJson) {
				const patch = diffObject(this.#lastSentClientJson || {}, newJson || {})
				if (patch.length > 0) {
					this.deps.changeEvents.emit('customFeedbackChange', this.controlId, {
						type: 'update',
						controlId: this.controlId,
						patch,
					})
				}
			} else {
				this.deps.changeEvents.emit('customFeedbackChange', this.controlId, {
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

		this.deps.events.emit('customFeedbackDefinitionChanged', this.controlId)
	}

	destroy(): void {
		this.entities.destroy()

		super.destroy()

		this.deps.events.emit('customFeedbackDefinitionChanged', this.controlId)

		if (this.deps.changeEvents.listenerCount('customFeedbackChange') > 0) {
			this.deps.changeEvents.emit('customFeedbackChange', this.controlId, {
				type: 'remove',
				controlId: this.controlId,
			})
		}
	}

	/**
	 * Nothing to react to, as a custom feedback doesn't draw anything on its own. The feedbacks which use it are given
	 * their values by their own copies of it
	 */
	protected triggerInvalidation(): void {
		// Nothing to do
	}

	get drawing(): null {
		return null // Custom feedbacks don't draw
	}

	/**
	 * Execute a press of this control
	 */
	pressControl(_pressed: boolean, _source: ControlPressSource | null): void {
		// Nothing to do
	}
}
