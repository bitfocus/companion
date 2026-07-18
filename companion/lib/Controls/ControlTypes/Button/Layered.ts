import type { JsonValue } from 'type-fest'
import { FONTSIZE_SHRINK_DEFAULT } from '@companion-app/shared/Graphics/ElementPropertiesSchemas.js'
import type {
	LayeredButtonModel,
	LayeredButtonOptions,
	NormalButtonRuntimeProps,
} from '@companion-app/shared/Model/ButtonModel.js'
import type { ExpressionOrValue } from '@companion-app/shared/Model/Options.js'
import type { SomeButtonGraphicsElement } from '@companion-app/shared/Model/StyleLayersModel.js'
import {
	ButtonGraphicsDecorationType,
	ButtonGraphicsElementUsage,
	ButtonGraphicsShowStatusIcons,
	type ButtonStyleProperties,
} from '@companion-app/shared/Model/StyleModel.js'
import { VisitorReferencesCollector } from '../../../Resources/Visitors/ReferencesCollector.js'
import { VisitorReferencesUpdater } from '../../../Resources/Visitors/ReferencesUpdater.js'
import type { ControlDependencies } from '../../ControlDependencies.js'
import type { ControlActionSetAndStepsEditor } from '../../Entities/ControlActionSetAndStepsManager.js'
import type { ControlEntityListChangeProps } from '../../Entities/EntityListPoolBase.js'
import type {
	ControlWithActions,
	ControlWithActionSets,
	ControlWithLayeredStyle,
	ControlWithoutEvents,
} from '../../IControlFragments.js'
import { ButtonControlBase } from './Base.js'
import { LayeredButtonStyleEditor } from './LayeredButtonStyleEditor.js'

/**
 * Class for the button control with layer based rendering.
 *
 * The layered rendering (and its editing) lives in a composed {@link MutableLayeredButtonDrawer} (`drawing`);
 * this control wires it into the runtime/entity machinery and the existing control event flows.
 *
 * @author Julian Waller <me@julusian.co.uk>
 * @since 4.0.0
 * @copyright 2025 Bitfocus AS
 * @license
 * This program is free software.
 * You should have received a copy of the MIT licence as well as the Bitfocus
 * Individual Contributor License Agreement for Companion along with
 * this program.
 *
 * You can be released from the requirements of the license by purchasing
 * a commercial license. Buying such a license is mandatory as soon as you
 * develop commercial activities involving the Companion software without
 * disclosing the source code of your own applications.
 */
export class ControlButtonLayered
	extends ButtonControlBase<LayeredButtonModel, LayeredButtonOptions>
	implements ControlWithLayeredStyle, ControlWithActions, ControlWithoutEvents, ControlWithActionSets
{
	readonly type = 'button-layered'

	/**
	 * The defaults style for a button
	 */
	static DefaultElements: SomeButtonGraphicsElement[] = [
		{
			id: 'canvas',
			name: 'Canvas',
			usage: ButtonGraphicsElementUsage.Automatic,
			type: 'canvas',
			decoration: { value: ButtonGraphicsDecorationType.FollowDefault, isExpression: false },
			showStatusIcons: { value: ButtonGraphicsShowStatusIcons.FollowDefault, isExpression: false },
		},
		{
			id: 'box0',
			name: 'Background',
			usage: ButtonGraphicsElementUsage.Automatic,
			type: 'box',
			enabled: { value: true, isExpression: false },
			opacity: { value: 100, isExpression: false },
			x: { value: 0, isExpression: false },
			y: { value: 0, isExpression: false },
			width: { value: 100, isExpression: false },
			height: { value: 100, isExpression: false },
			rotation: { value: 0, isExpression: false },
			color: { value: 0x000000, isExpression: false },
			borderWidth: { value: 0, isExpression: false },
			borderColor: { value: 0, isExpression: false },
			borderPosition: { value: 'inside', isExpression: false },
		},
		{
			id: 'text0',
			name: 'Text',
			usage: ButtonGraphicsElementUsage.Automatic,
			type: 'text',
			enabled: { value: true, isExpression: false },
			opacity: { value: 100, isExpression: false },
			x: { value: 0, isExpression: false },
			y: { value: 0, isExpression: false },
			width: { value: 100, isExpression: false },
			height: { value: 100, isExpression: false },
			rotation: { value: 0, isExpression: false },
			text: { value: '', isExpression: false },
			color: { value: 0xffffff, isExpression: false },
			halign: { value: 'center', isExpression: false },
			valign: { value: 'center', isExpression: false },
			fontsize: { value: FONTSIZE_SHRINK_DEFAULT, isExpression: false },
			fontsizeAllowShrink: { value: true, isExpression: false },
			font: { value: 'companion-sans', isExpression: false },
			weight: { value: 'normal', isExpression: false },
			styles: { value: [], isExpression: false },
			outlineColor: { value: 0xff000000, isExpression: false },
		},
	]

	readonly supportsActions = true
	readonly supportsEvents = false
	readonly supportsActionSets = true
	readonly supportsLayeredStyle = true

	/**
	 * The composed layered rendering + editing. Exposed (as the base `drawing`) so callers can reach the
	 * drawing surface directly.
	 */
	readonly #drawing: LayeredButtonStyleEditor
	override get drawing(): LayeredButtonStyleEditor {
		return this.#drawing
	}

	get actionSets(): ControlActionSetAndStepsEditor {
		return this.entities
	}

	constructor(deps: ControlDependencies, controlId: string, storage: LayeredButtonModel | null, isImport: boolean) {
		super(deps, controlId, `Controls/Button/Normal/${controlId}`, true)

		this.options = {
			...structuredClone(ButtonControlBase.DefaultOptions),
			rotaryActions: false,
			canModifyStyleInApis: false,
			notes: '',
		}

		this.#drawing = new LayeredButtonStyleEditor(deps, controlId, {
			getButtonStateProps: () => this.getDrawStyleButtonStateProps(),
			entities: this.entities,
			commitChange: (redraw) => this.commitChange(redraw),
			emitElementChanged: (id) => this.deps.events.emit('layeredStyleElementChanged', this.controlId, id),
		})

		if (!storage) {
			// New control
			this.drawing.loadElements(structuredClone(ControlButtonLayered.DefaultElements))

			this.commitChange()
			this.sendRuntimePropsChange()
		} else {
			if (storage.type !== 'button-layered')
				throw new Error(`Invalid type given to ControlButtonLayered: "${storage.type}"`)

			this.drawing.loadElements(structuredClone(storage.style.layers))
			this.options = Object.assign(this.options, storage.options || {})
			this.entities.setupRotaryActionSets(!!this.options.rotaryActions, true)
			this.entities.loadStorage(storage, true, isImport)
			this.entities.stepExpressionUpdate(this.options)

			// Ensure control is stored before setup
			if (isImport) setImmediate(() => this.postProcessImport())
		}
	}

	protected override entityListReportChange(options: ControlEntityListChangeProps): void {
		if (!options.noSave) {
			this.commitChange(false)
		}
		if (options.invalidateAllElements) {
			this.drawing.clearCache()
		} else if (options.changedElementIds) {
			for (const elementId of options.changedElementIds) {
				this.drawing.invalidateElement(elementId)
			}
		}

		if (options.redraw || options.changedElementIds || options.invalidateAllElements) {
			this.triggerInvalidation()
		}
	}

	/**
	 * Collect the instance ids, labels, and variables referenced by this control
	 */
	collectReferencedConnectionsAndVariables(
		foundConnectionIds: Set<string>,
		foundConnectionLabels: Set<string>,
		foundVariables: Set<string>
	): void {
		const collector = new VisitorReferencesCollector(
			this.deps.internalModule,
			foundConnectionIds,
			foundConnectionLabels,
			foundVariables,
			undefined
		)
		collector.visitEntities(this.entities.getAllEntities(), [])
		this.drawing.visit(collector)
	}

	layeredStyleAddElement(type: string, index: number | null): string {
		return this.drawing.addElement(type, index)
	}

	layeredStyleRemoveElement(id: string): boolean {
		return this.drawing.removeElement(id)
	}

	layeredStyleDuplicateElement(id: string): string | false {
		return this.drawing.duplicateElement(id)
	}

	layeredStyleSetElementName(id: string, name: string): boolean {
		return this.drawing.setElementName(id, name)
	}

	layeredStyleSetElementUsage(id: string, usage: ButtonGraphicsElementUsage): boolean {
		return this.drawing.setElementUsage(id, usage)
	}

	layeredStyleGetElementById(id: string): SomeButtonGraphicsElement | undefined {
		return this.drawing.getElementById(id)
	}

	layeredStyleSelectedElementIds(): { [usage in ButtonGraphicsElementUsage]: string | undefined } {
		return this.drawing.selectedElementIds()
	}

	layeredStyleMoveElement(id: string, parentElementId: string | null, newIndex: number): boolean {
		return this.drawing.moveElement(id, parentElementId, newIndex)
	}

	layeredStyleUpdateOption(id: string, key: string, newVal: ExpressionOrValue<JsonValue | undefined>): boolean {
		return this.drawing.updateOption(id, key, newVal)
	}

	layeredStyleUpdateFromLegacyProperties(diff: Partial<ButtonStyleProperties>): boolean {
		return this.drawing.updateFromLegacyProperties(diff, this.options.canModifyStyleInApis)
	}

	/**
	 * Rename a connection for variables used in this control
	 */
	renameVariables(labelFrom: string, labelTo: string): void {
		const updater = new VisitorReferencesUpdater(
			this.deps.internalModule,
			{ [labelFrom]: labelTo },
			undefined,
			undefined
		)
		updater.visitEntities(this.entities.getAllEntities(), [])
		this.drawing.visit(updater)
		const changed = updater.recheckChangedFeedbacks().hasChanges()

		if (changed) {
			// Purge all cache, as we don't know what could have changed
			this.drawing.clearCache()
		}

		// redraw if needed and save changes
		this.commitChange(changed)
	}

	/**
	 * Update an option field of this control
	 */
	optionsSetField(key: string, value: JsonValue): boolean {
		const changed = super.optionsSetField(key, value)

		if (key === 'stepProgression' || key === 'stepExpression') {
			this.entities.stepExpressionUpdate(this.options)
		}

		return changed
	}

	/**
	 * Convert this control to JSON
	 * To be sent to the client and written to the db
	 */
	override toJSON(clone = true): LayeredButtonModel {
		const obj: LayeredButtonModel = {
			type: this.type,
			style: { layers: [...this.drawing.drawElements] },
			options: this.options,
			feedbacks: this.entities.getFeedbackEntities(),
			steps: this.entities.asNormalButtonSteps(),
			localVariables: this.entities.getLocalVariableEntities().map((ent) => ent.asEntityModel(true)),
		}

		return clone ? structuredClone(obj) : obj
	}

	/**
	 * Get any volatile properties for the control
	 */
	override toRuntimeJSON(): NormalButtonRuntimeProps {
		return {
			current_step_id: this.entities.currentStepId,
		}
	}
}
