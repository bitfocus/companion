import { ControlBase } from '../ControlBase.js'
import { cloneDeep } from 'lodash-es'
import debounceFn from 'debounce-fn'
import type {
	ControlWithoutActions,
	ControlWithoutEvents,
	ControlWithOptions,
	ControlWithoutActionSets,
	ControlWithoutPushed,
	ControlWithoutStyle,
	ControlWithEntities,
	ControlWithoutLayeredStyle,
} from '../IControlFragments.js'
import { VisitorReferencesUpdater } from '../../Resources/Visitors/ReferencesUpdater.js'
import { VisitorReferencesCollector } from '../../Resources/Visitors/ReferencesCollector.js'
import type { ControlDependencies } from '../ControlDependencies.js'
import { EntityListPoolExpressionVariable } from '../Entities/EntityListPoolExpressionVariable.js'
import { EntityModelType } from '@companion-app/shared/Model/EntityModel.js'
import { DrawStyleModel } from '@companion-app/shared/Model/StyleModel.js'
import {
	ClientExpressionVariableData,
	ExpressionVariableModel,
	ExpressionVariableOptions,
} from '@companion-app/shared/Model/ExpressionVariableModel.js'
import jsonPatch from 'fast-json-patch'
import { ExpressionVariableNameMap } from '../ExpressionVariableNameMap.js'
import { isLabelValid } from '@companion-app/shared/Label.js'

/**
 * Class for an expression variable.
 *
 * @author Julian Waller <me@julusian.co.uk>
 * @since 4.1.0
 * @copyright 2022 Bitfocus AS
 * @license
 * This program is free software.
 * You should have received a copy of the MIT licence as well as the Bitfocus
 * Individual Contributor License Agreement for Companion along with
 * this program.
 */
export class ControlExpressionVariable
	extends ControlBase<ExpressionVariableModel>
	implements
		ControlWithoutActions,
		ControlWithoutEvents,
		ControlWithEntities,
		ControlWithoutStyle,
		ControlWithoutLayeredStyle,
		ControlWithoutActionSets,
		ControlWithOptions,
		ControlWithoutPushed
{
	readonly type = 'expression-variable'

	readonly supportsActions = false
	readonly supportsEvents = false
	readonly supportsEntities = true
	readonly supportsStyle = false
	readonly supportsLayeredStyle = false
	readonly supportsActionSets = false
	readonly supportsOptions = true
	readonly supportsPushed = false

	readonly #expressionVariableNameMap: ExpressionVariableNameMap

	/**
	 * The defaults options for a trigger
	 */
	static DefaultOptions: ExpressionVariableOptions = {
		variableName: '',
		description: 'An expression variable',
		sortOrder: 0,
	}

	/**
	 * The last sent expression-variable json object
	 */
	#lastSentDefinitionJson: ClientExpressionVariableData | null = null

	/**
	 * Basic trigger configuration
	 */
	options: ExpressionVariableOptions

	readonly entities: EntityListPoolExpressionVariable

	/**
	 * @param registry - the application core
	 * @param eventBus - the main trigger event bus
	 * @param controlId - id of the control
	 * @param storage - persisted storage object
	 * @param isImport - if this is importing a button, not creating at startup
	 */
	constructor(
		deps: ControlDependencies,
		expressionVariableNameMap: ExpressionVariableNameMap,
		controlId: string,
		storage: ExpressionVariableModel | null,
		isImport: boolean
	) {
		super(deps, controlId, `Controls/ControlTypes/ExpressionVariable/${controlId}`)

		this.#expressionVariableNameMap = expressionVariableNameMap

		this.entities = new EntityListPoolExpressionVariable({
			controlId,
			commitChange: this.commitChange.bind(this),
			invalidateControl: this.triggerRedraw.bind(this),
			instanceDefinitions: deps.instance.definitions,
			internalModule: deps.internalModule,
			moduleHost: deps.instance.moduleHost,
			variableValues: deps.variables.values,
		})

		this.options = cloneDeep(ControlExpressionVariable.DefaultOptions)

		if (!storage) {
			// New control

			// Save the change
			this.commitChange()

			// Notify interested
		} else {
			if (storage.type !== 'expression-variable')
				throw new Error(`Invalid type given to ControlExpressionVariable: "${storage.type}"`)

			this.options = storage.options || this.options
			this.entities.loadStorage(storage, true, isImport)

			if (isImport) this.#postProcessImport()
			else this.commitChange()
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
			foundVariables
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
	toJSON(clone = true): ExpressionVariableModel {
		const obj: ExpressionVariableModel = {
			type: this.type,
			options: this.options,
			entity: this.entities.getRootEntity()?.asEntityModel(true) || null,
			localVariables: this.entities.getLocalVariableEntities().map((e) => e.asEntityModel(true)),
		}
		return clone ? cloneDeep(obj) : obj
	}

	toClientJSON(): ClientExpressionVariableData {
		return {
			type: this.type,
			...this.options,
			isActive: this.#expressionVariableNameMap.isExpressionVariableActive(this.controlId),
		}
	}

	/**
	 * Rename an instance for variables used in this control
	 * @param labelFrom - the old instance short name
	 * @param labelTo - the new instance short name
	 * @access public
	 */
	renameVariables(labelFrom: string, labelTo: string): void {
		const allEntities = this.entities.getAllEntities()

		// Fix up references
		const changed = new VisitorReferencesUpdater(this.deps.internalModule, { [labelFrom]: labelTo }, undefined)
			.visitEntities(allEntities, [])
			.recheckChangedFeedbacks()
			.hasChanges()

		// 'redraw' if needed and save changes
		this.commitChange(changed)
	}

	/**
	 * Update an option field of this control
	 */
	// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
	optionsSetField(key: string, value: any, forceSet?: boolean): boolean {
		if (!forceSet && (key === 'sortOrder' || key === 'collectionId'))
			throw new Error('sortOrder cannot be set by the client')

		// Handle expression variable name changes
		if (key === 'variableName') {
			// Make sure the new name is valid
			if (value != '' && !isLabelValid(value)) {
				throw new Error(`Invalid variable name "${value}"`)
			}

			const oldVariableName = this.options.variableName
			this.options[key] = value

			// Update the names map through the dependency
			this.#expressionVariableNameMap.updateExpressionVariableName(this.controlId, oldVariableName, value)
		} else {
			// @ts-expect-error mismatch in types
			this.options[key] = value
		}

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
		const newJson = cloneDeep(this.toClientJSON())

		if (this.deps.changeEvents.listenerCount('expressionVariableChange') > 0) {
			if (this.#lastSentDefinitionJson) {
				const patch = jsonPatch.compare(this.#lastSentDefinitionJson || {}, newJson || {})
				if (patch.length > 0) {
					this.deps.changeEvents.emit('expressionVariableChange', this.controlId, {
						type: 'update',
						controlId: this.controlId,
						patch,
					})
				}
			} else {
				this.deps.changeEvents.emit('expressionVariableChange', this.controlId, {
					type: 'add',
					controlId: this.controlId,
					info: newJson,
				})
			}
		}

		this.#lastSentDefinitionJson = newJson
	}

	commitChange(redraw = true): void {
		super.commitChange(redraw)

		this.#sendClientJsonChange()

		this.deps.events.emit('expressionVariableDefinitionChanged', this.controlId, this.toClientJSON())
	}

	destroy(): void {
		this.entities.destroy()

		this.#expressionVariableNameMap.removeExpressionVariable(this.controlId, this.options.variableName)

		super.destroy()

		this.deps.events.emit('expressionVariableDefinitionChanged', this.controlId, null)

		if (this.deps.changeEvents.listenerCount('expressionVariableChange') > 0) {
			this.deps.changeEvents.emit('expressionVariableChange', this.controlId, {
				type: 'remove',
				controlId: this.controlId,
			})
		}
	}

	/**
	 * Trigger a recheck of the condition, as something has changed and it might be the 'condition'
	 * @access protected
	 */
	triggerRedraw = debounceFn(
		() => {
			const name = this.options.variableName
			if (!name) return

			// Only emit variable value if this control is the active one for this variable name
			if (this.#expressionVariableNameMap.isExpressionVariableActive(this.controlId)) {
				this.deps.variables.values.setVariableValues('expression', [
					{ id: name, value: this.entities.getRootEntity()?.getResolvedFeedbackValue() },
				])
			}
		},
		{
			before: false,
			after: true,
			wait: 10,
			maxWait: 20,
		}
	)

	getLastDrawStyle(): DrawStyleModel | null {
		return null
	}

	/**
	 * Execute a press of this control
	 */
	pressControl(_pressed: boolean, _surfaceId: string | undefined): void {
		// Nothing to do
	}
	getBitmapFeedbackSize(): { width: number; height: number } | null {
		return null
	}
}
