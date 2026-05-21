import type { SomeButtonGraphicsElement } from '@companion-app/shared/Model/StyleLayersModel.js'
import { type DrawStyleLayeredButtonModel } from '@companion-app/shared/Model/StyleModel.js'
import { ConvertSomeButtonGraphicsElementForDrawing } from '../../Graphics/ConvertGraphicsElements.js'
import { ElementConversionCache } from '../../Graphics/ElementConversionCache.js'
import { ControlBase } from '../ControlBase.js'
import type {
	ControlWithoutActions,
	ControlWithoutActionSets,
	ControlWithoutEvents,
	ControlWithoutLayeredStyle,
	ControlWithoutOptions,
	ControlWithoutPushed,
} from '../IControlFragments.js'

const emptyMap: ReadonlyMap<string, never> = new Map<string, never>()

/**
 * Class for some page button control.
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
 */
export abstract class ControlButtonPage<TJson>
	extends ControlBase<TJson>
	implements
		ControlWithoutActions,
		ControlWithoutLayeredStyle,
		ControlWithoutEvents,
		ControlWithoutActionSets,
		ControlWithoutOptions,
		ControlWithoutPushed
{
	readonly supportsActions = false
	readonly supportsEntities = false
	readonly supportsLayeredStyle = false
	readonly supportsEvents = false
	readonly supportsActionSets = false
	readonly supportsOptions = false
	readonly supportsPushed = false

	/**
	 * The variables referenced in the last draw. Whenever one of these changes, a redraw should be performed
	 */
	#lastDrawVariables: ReadonlySet<string> | null = null

	/**
	 * Cache for element conversion results (for future per-element caching optimization)
	 */
	readonly #elementConversionCache = new ElementConversionCache()

	/**
	 * Prepare this control for deletion
	 */
	destroy(): void {
		this.#elementConversionCache.clear()
		super.destroy()
	}

	/**
	 * Get the complete style object of a button
	 * @returns the processed style of the button
	 */
	#lastDrawStyle: DrawStyleLayeredButtonModel | null = null
	getLastDrawStyle(): DrawStyleLayeredButtonModel | null {
		return this.#lastDrawStyle
	}

	protected abstract getDrawElements(): {
		drawType: DrawStyleLayeredButtonModel['drawType']
		elements: SomeButtonGraphicsElement[]
	}

	/**
	 * Get the complete style object of a button
	 * @returns the processed style of the button
	 */
	async getDrawStyle(): Promise<DrawStyleLayeredButtonModel | null> {
		const location = this.deps.pageStore.getLocationOfControlId(this.controlId)
		const parser = this.deps.variableValues.createVariablesAndExpressionParser(location, null, null)

		const { drawType, elements: rawElements } = this.getDrawElements()

		// Compute the new drawing, using the element conversion cache for per-element caching
		const { elements, usedVariables } = await ConvertSomeButtonGraphicsElementForDrawing(
			this.deps.instance.definitions,
			parser,
			this.deps.graphics.renderPixelBuffers.bind(this.deps.graphics),
			rawElements,
			emptyMap,
			true,
			this.#elementConversionCache
		)
		this.#lastDrawVariables = usedVariables.size > 0 ? usedVariables : null

		const result: DrawStyleLayeredButtonModel = {
			pushed: false,
			stepCurrent: 0,
			stepCount: 0,
			button_status: undefined,
			action_running: undefined,

			elements,

			style: 'button-layered',
			drawType: drawType,
		}

		this.#lastDrawStyle = result
		return result
	}

	/**
	 * Collect the connection ids, labels, and variables referenced by this control
	 * @param foundConnectionIds - connection ids being referenced
	 * @param foundConnectionLabels - connection labels being referenced
	 * @param foundVariables - variables being referenced
	 */
	collectReferencedConnectionsAndVariables(
		_foundConnectionIds: Set<string>,
		_foundConnectionLabels: Set<string>,
		_foundVariables: Set<string>
	): void {
		// Nothing being referenced
	}

	/**
	 * Inform the control that it has been moved, and anything relying on its location must be invalidated
	 */
	triggerLocationHasChanged(): void {
		// Ensure any dependencies on the location in the drawing are updated
		this.#elementConversionCache.clear()
		this.triggerRedraw()
	}

	renameVariables(_labelFrom: string, _labelTo: string): void {
		// Nothing to do
	}

	/**
	 * Propagate variable changes
	 * @param allChangedVariables - variables with changes
	 */
	onVariablesChanged(allChangedVariables: ReadonlySet<string>): void {
		if (!this.#lastDrawVariables) return
		if (this.#lastDrawVariables.isDisjointFrom(allChangedVariables)) return

		// Queue invalidation for cached elements that use any of the changed variables
		this.#elementConversionCache.queueInvalidateVariables(allChangedVariables)

		this.logger.silly('variable changed in button ' + this.controlId)
		this.triggerRedraw()
	}
}
