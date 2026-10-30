import type { JsonValue } from 'type-fest'
import { diffObject } from '@companion-app/shared/Diff.js'
import { BANNED_PROPS } from '@companion-app/shared/Expressions.js'
import type {
	ClientCustomFeedbackData,
	CustomFeedbackModel,
	CustomFeedbackOptions,
} from '@companion-app/shared/Model/CustomFeedbackModel.js'
import type { ClientEntityDefinition } from '@companion-app/shared/Model/EntityDefinitionModel.js'
import { EntityModelType, FeedbackEntitySubType } from '@companion-app/shared/Model/EntityModel.js'
import type { AuthorableInputField, ExpressionableOptionsObject } from '@companion-app/shared/Model/Options.js'
import type { VariableValues } from '@companion-app/shared/Model/Variables.js'
import type { CompanionOptionValues } from '@companion-module/base'
import { VisitorReferencesCollector } from '../../Resources/Visitors/ReferencesCollector.js'
import { VisitorReferencesUpdater } from '../../Resources/Visitors/ReferencesUpdater.js'
import type {
	ExpressionParserOptions,
	VariablesAndExpressionParser,
} from '../../Variables/VariablesAndExpressionParser.js'
import { ControlBase } from '../ControlBase.js'
import type { ControlDependencies } from '../ControlDependencies.js'
import { buildCustomActionOptionsVariables } from '../CustomActionRunFrame.js'
import { CustomEntityInputs } from '../CustomEntities/CustomEntityInputs.js'
import type { CustomEntitySource, CustomEntityValues } from '../CustomEntities/Types.js'
import type { ControlEntityInstance } from '../Entities/EntityInstance.js'
import type { ControlEntityListChangeProps } from '../Entities/EntityListPoolBase.js'
import { ControlEntityListPoolCustomFeedback } from '../Entities/EntityListPoolCustomFeedback.js'
import type {
	ControlWithEntities,
	ControlWithOptions,
	ControlWithoutActions,
	ControlWithoutActionSets,
	ControlWithoutEvents,
	ControlWithoutLayeredStyle,
	ControlWithoutPushed,
} from '../IControlFragments.js'

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
	extends ControlBase<CustomFeedbackModel>
	implements
		ControlWithoutActions,
		ControlWithoutEvents,
		ControlWithEntities,
		ControlWithoutLayeredStyle,
		ControlWithoutActionSets,
		ControlWithOptions,
		ControlWithoutPushed,
		CustomEntitySource
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

	/**
	 * The defaults options for a custom feedback
	 */
	static DefaultOptions: CustomFeedbackOptions = {
		name: 'New custom feedback',
		description: '',
		sortOrder: 0,
		notes: '',
	}

	/**
	 * The last sent custom feedback json object
	 */
	#lastSentClientJson: ClientCustomFeedbackData | null = null

	/**
	 * Basic configuration
	 */
	options: CustomFeedbackOptions

	/**
	 * The inputs of the custom feedback
	 */
	readonly #inputs = new CustomEntityInputs([])

	readonly entities: ControlEntityListPoolCustomFeedback

	get inputs(): ReadonlyArray<AuthorableInputField> {
		return this.#inputs.inputs
	}

	/**
	 * @param deps - the control dependencies
	 * @param controlId - id of the control
	 * @param storage - persisted storage object
	 * @param isImport - if this is importing a custom feedback, not creating at startup
	 */
	constructor(deps: ControlDependencies, controlId: string, storage: CustomFeedbackModel | null, isImport: boolean) {
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
			getPageVariableEntities: deps.getPageVariableEntities,
			customActionInstances: deps.customActionInstances,
			customFeedbackInstances: deps.customFeedbackInstances,
			getDefaultOptionsVariables: () => buildCustomActionOptionsVariables(this.#inputs.getDefaultValues()),
		})

		this.options = structuredClone(ControlCustomFeedback.DefaultOptions)

		if (!storage) {
			// New control

			// Save the change
			this.commitChange()
		} else {
			if (storage.type !== 'custom-feedback')
				throw new Error(`Invalid type given to ControlCustomFeedback: "${storage.type}"`)

			this.options = { ...this.options, ...storage.options }
			// The inputs are checked by the schema of the custom feedback when it is loaded
			this.#inputs = new CustomEntityInputs(storage.inputs)
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
	toFeedbackDefinition(): ClientEntityDefinition {
		return {
			entityType: EntityModelType.Feedback,
			label: this.options.name || 'Custom feedback',
			sortKey: null,
			description: this.options.description || undefined,
			options: this.#inputs.toOptionFields(),
			optionsToMonitorForInvalidations: null,
			feedbackType: FeedbackEntitySubType.Boolean,
			feedbackStyle: undefined,
			feedbackDisableStyleOverrides: false,
			feedbackStyleOverridesUnsupported: false,
			hasLifecycleFunctions: false,
			hasLearn: false,
			learnTimeout: undefined,
			showInvert: true,
			actionHasResult: undefined,
			actionOutputs: null,
			feedbackAffectedProperties: undefined,
			optionsSupportExpressions: true,
			showButtonPreview: false,
			supportsChildGroups: [],
		}
	}

	/**
	 * Parse the options of a feedback which uses this custom feedback into the values of the inputs.
	 * An input which is missing or has an invalid value gets its default value, so that a change to the inputs of
	 * the custom feedback doesn't stop the feedbacks using it from working
	 * @param rawOptions The options of the calling feedback
	 * @param parser A parser in the context of the caller
	 * @param callerControlId The control holding the calling feedback, if there is one
	 */
	parseCallInputs(
		rawOptions: ExpressionableOptionsObject,
		parser: VariablesAndExpressionParser,
		callerControlId: string | null
	): { options: CompanionOptionValues; referencedVariableIds: ReadonlySet<string> } {
		return this.#inputs.parseCallInputs(this.toFeedbackDefinition(), rawOptions, parser, callerControlId, this.logger)
	}

	/**
	 * A parser for the entities of a copy of this custom feedback, held by a feedback which uses it
	 * @param values The inputs and local variable values of the copy
	 * @param callerControlId The control which holds the copy, which provides the `this:*` and `page:*` variables
	 * @param localVariableEntities The local variables of the copy
	 * @param overrideVariableValues Any additional variables
	 * @param options Options for the parser
	 */
	createCopyParser(
		values: CustomEntityValues,
		callerControlId: string,
		localVariableEntities: ControlEntityInstance[],
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
			{ ...buildCustomActionOptionsVariables(values.options), ...overrideVariableValues },
			options
		)
	}

	/**
	 * Add an input
	 */
	inputAdd(field: AuthorableInputField): boolean {
		if (!this.#inputs.add(field)) return false

		this.commitChange()
		return true
	}

	/**
	 * Remove an input
	 */
	inputRemove(inputId: string): boolean {
		if (!this.#inputs.remove(inputId)) return false

		this.commitChange()
		return true
	}

	/**
	 * Move an input to a new position in the list
	 * @param inputId The id of the input
	 * @param target The index to move it to
	 */
	inputMove(inputId: string, target: number): boolean {
		if (!this.#inputs.move(inputId, target)) return false

		this.commitChange()
		return true
	}

	/**
	 * Replace an input. If the new input has a different id, the references to it in the feedbacks of this custom
	 * feedback are updated. The caller is responsible for updating the feedbacks which use this custom feedback
	 * @returns Whether the input was updated
	 */
	inputUpdate(inputId: string, field: AuthorableInputField): boolean {
		if (!this.#inputs.update(inputId, field, this.entities.getAllEntities())) return false

		this.commitChange()
		return true
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
	toJSON(clone = true): CustomFeedbackModel {
		const obj: CustomFeedbackModel = {
			type: this.type,
			options: this.options,
			inputs: this.#inputs.toJSON(),
			feedbacks: this.entities.getFeedbackEntities().map((e) => e.asEntityModel(true)),
			localVariables: this.entities.getLocalVariableEntities().map((e) => e.asEntityModel(true)),
		}
		return clone ? structuredClone(obj) : obj
	}

	toClientJSON(): ClientCustomFeedbackData {
		return {
			type: this.type,
			...this.options,
		}
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
	pressControl(_pressed: boolean, _surfaceId: string | undefined): void {
		// Nothing to do
	}
}
