import { ButtonControlBase } from './Base.js'
import { cloneDeep } from 'lodash-es'
import { VisitorReferencesCollector } from '../../../Resources/Visitors/ReferencesCollector.js'
import type {
	ControlWithActionSets,
	ControlWithActions,
	ControlWithLayeredStyle,
	ControlWithoutEvents,
	ControlWithoutStyle,
} from '../../IControlFragments.js'
import { ReferencesVisitors } from '../../../Resources/Visitors/ReferencesVisitors.js'
import type { LayeredButtonModel, NormalButtonOptions } from '@companion-app/shared/Model/ButtonModel.js'
import type { ControlDependencies } from '../../ControlDependencies.js'
import type { ControlActionSetAndStepsManager } from '../../Entities/ControlActionSetAndStepsManager.js'
import { ButtonGraphicsDecorationType, SomeButtonGraphicsLayer } from '@companion-app/shared/Model/StyleLayersModel.js'
import { DrawStyleModel } from '@companion-app/shared/Model/StyleModel.js'
import { CreateLayerOfType } from './LayerDefaults.js'

/**
 * Class for the button control with layer based rendering.
 *
 * @author Håkon Nessjøen <haakon@bitfocus.io>
 * @author Keith Rocheck <keith.rocheck@gmail.com>
 * @author William Viker <william@bitfocus.io>
 * @author Julian Waller <me@julusian.co.uk>
 * @since 3.0.0
 * @copyright 2022 Bitfocus AS
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
	extends ButtonControlBase<LayeredButtonModel, NormalButtonOptions>
	implements
		ControlWithoutStyle,
		ControlWithLayeredStyle,
		ControlWithActions,
		ControlWithoutEvents,
		ControlWithActionSets
{
	readonly type = 'button-layered'

	/**
	 * The defaults style for a button
	 */
	static DefaultLayers: SomeButtonGraphicsLayer[] = [
		{
			id: 'canvas',
			type: 'canvas',
			color: 0x000000,
			decoration: ButtonGraphicsDecorationType.FollowDefault,
		},
		{
			id: 'text0',
			type: 'text',
			text: '',
			isExpression: false,
			color: 0xffffff,
			alignment: 'center:center',
			fontsize: 'auto',
		},
	]

	readonly supportsActions = true
	readonly supportsEvents = false
	readonly supportsActionSets = true
	readonly supportsStyle = false
	readonly supportsLayeredStyle = true

	/**
	 * The variabls referenced in the last draw. Whenever one of these changes, a redraw should be performed
	 */
	#last_draw_variables: Set<string> | null = null

	/**
	 * The base style without feedbacks applied
	 */
	#drawLayers: SomeButtonGraphicsLayer[] = cloneDeep(ControlButtonLayered.DefaultLayers)

	get actionSets(): ControlActionSetAndStepsManager {
		return this.entities
	}

	constructor(deps: ControlDependencies, controlId: string, storage: LayeredButtonModel | null, isImport: boolean) {
		super(deps, controlId, `Controls/Button/Normal/${controlId}`)

		this.options = {
			...cloneDeep(ButtonControlBase.DefaultOptions),
			rotaryActions: false,
			stepAutoProgress: true,
		}

		if (!storage) {
			// New control

			// Save the change
			this.commitChange()
			this.sendRuntimePropsChange()
		} else {
			if (storage.type !== 'button-layered')
				throw new Error(`Invalid type given to ControlButtonLayered: "${storage.type}"`)

			this.#drawLayers = storage.style.layers || this.#drawLayers
			this.options = Object.assign(this.options, storage.options || {})
			this.entities.setupRotaryActionSets(!!this.options.rotaryActions, true)
			this.entities.loadStorage(storage, true, isImport)

			// Ensure control is stored before setup
			if (isImport) setImmediate(() => this.postProcessImport())
		}
	}

	/**
	 * Prepare this control for deletion
	 */
	destroy(): void {
		super.destroy()
	}

	/**
	 * Get the size of the bitmap render of this control
	 */
	getBitmapFeedbackSize(): { width: number; height: number } | null {
		// TODO-layered: implement this
		return null
		// return GetButtonBitmapSize(this.deps.userconfig, this.#baseStyle)
	}

	/**
	 * Get the complete style object of a button
	 * @returns the processed style of the button
	 */
	getDrawStyle(): DrawStyleModel | null {
		// TODO-layered: update #last_draw_variables

		return {
			...this.getDrawStyleButtonStateProps(),

			layers: this.#drawLayers,

			style: 'button-layered',
		}
	}

	/**
	 * Collect the instance ids and labels referenced by this control
	 * @param foundConnectionIds - instance ids being referenced
	 * @param foundConnectionLabels - instance labels being referenced
	 */
	collectReferencedConnections(foundConnectionIds: Set<string>, foundConnectionLabels: Set<string>): void {
		const allEntities = this.entities.getAllEntities()

		for (const entity of allEntities) {
			foundConnectionIds.add(entity.connectionId)
		}

		const visitor = new VisitorReferencesCollector(foundConnectionIds, foundConnectionLabels)

		ReferencesVisitors.visitControlReferences(this.deps.internalModule, visitor, undefined, [], allEntities, [])
	}

	layeredStyleAddLayer(type: string, index: number | null): string {
		const newLayer = CreateLayerOfType(type as SomeButtonGraphicsLayer['type'])

		if (typeof index === 'number' && index >= 0 && index < this.#drawLayers.length) {
			this.#drawLayers.splice(index, 0, newLayer)
		} else {
			this.#drawLayers.push(newLayer)
		}

		// Save change and redraw
		this.commitChange(true)

		return newLayer.id
	}

	layeredStyleRemoveLayer(id: string): boolean {
		const indexOfLayer = this.#drawLayers.findIndex((layer) => layer.id === id)
		if (indexOfLayer === -1) return false

		this.#drawLayers.splice(indexOfLayer, 1)

		// Save change and redraw
		this.commitChange(true)

		return true
	}

	layeredStyleUpdateOptions(id: string, diff: Record<string, any>): boolean {
		// Prune some readonly properties
		delete diff.id
		delete diff.type

		// Find the layer
		const layer = this.#drawLayers.find((layer) => layer.id === id)
		if (!layer) return false

		// Apply the diff
		Object.assign(layer, diff)

		// Save change and redraw
		this.commitChange(true)

		return true
	}

	/**
	 * Rename a connection for variables used in this control
	 * @param labelFrom - the old connection short name
	 * @param labelTo - the new connection short name
	 */
	renameVariables(labelFrom: string, labelTo: string): void {
		const allEntities = this.entities.getAllEntities()

		// Fix up references
		const changed = ReferencesVisitors.fixupControlReferences(
			this.deps.internalModule,
			{ connectionLabels: { [labelFrom]: labelTo } },
			undefined,
			[],
			allEntities,
			[],
			true
		)

		// redraw if needed and save changes
		this.commitChange(changed)
	}

	/**
	 * Propagate variable changes
	 * @param allChangedVariables - variables with changes
	 */
	onVariablesChanged(allChangedVariables: Set<string>): void {
		if (!this.#last_draw_variables) return
		for (const variable of allChangedVariables.values()) {
			if (!this.#last_draw_variables.has(variable)) continue
			this.logger.silly('variable changed in button ' + this.controlId)

			this.triggerRedraw()
			return
		}
	}

	/**
	 * Convert this control to JSON
	 * To be sent to the client and written to the db
	 * @param clone - Whether to return a cloned object
	 */
	override toJSON(clone = true): LayeredButtonModel {
		const obj: LayeredButtonModel = {
			type: this.type,
			style: { layers: this.#drawLayers },
			options: this.options,
			feedbacks: this.entities.getFeedbackEntities(),
			steps: this.entities.asNormalButtonSteps(),
		}

		return clone ? cloneDeep(obj) : obj
	}

	/**
	 * Get any volatile properties for the control
	 */
	override toRuntimeJSON() {
		return {
			current_step_id: this.entities.currentStepId,
		}
	}
}
