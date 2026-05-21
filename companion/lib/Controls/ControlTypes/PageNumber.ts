import type { PageNumberButtonModel } from '@companion-app/shared/Model/ButtonModel.js'
import { exprExpr, exprVal } from '@companion-app/shared/Model/Options.js'
import type {
	ButtonGraphicsBoxElement,
	ButtonGraphicsGroupElement,
	ButtonGraphicsTextElement,
	SomeButtonGraphicsElement,
} from '@companion-app/shared/Model/StyleLayersModel.js'
import {
	ButtonGraphicsDecorationType,
	ButtonGraphicsElementUsage,
	ButtonGraphicsShowStatusIcons,
	type DrawStyleLayeredButtonModel,
} from '@companion-app/shared/Model/StyleModel.js'
import { ConvertSomeButtonGraphicsElementForDrawing } from '../../Graphics/ConvertGraphicsElements.js'
import { ElementConversionCache } from '../../Graphics/ElementConversionCache.js'
import { ControlBase } from '../ControlBase.js'
import type { ControlDependencies } from '../ControlDependencies.js'
import type {
	ControlWithoutActions,
	ControlWithoutActionSets,
	ControlWithoutEvents,
	ControlWithoutLayeredStyle,
	ControlWithoutOptions,
	ControlWithoutPushed,
} from '../IControlFragments.js'
import { CreateElementOfType } from './Button/LayerDefaults.js'

const emptyMap: ReadonlyMap<string, never> = new Map<string, never>()

export const pageNumberElements: SomeButtonGraphicsElement[] = [
	{
		type: 'canvas',
		id: 'canvas',
		name: 'Canvas',
		decoration: exprVal(ButtonGraphicsDecorationType.None),
		showStatusIcons: exprVal(ButtonGraphicsShowStatusIcons.None),
		usage: ButtonGraphicsElementUsage.Automatic,
	},
	{
		...(CreateElementOfType('box') as ButtonGraphicsBoxElement),
		color: exprVal(0x0f0f0f), // Grey background
	},

	{
		// If page has a name
		...(CreateElementOfType('group') as ButtonGraphicsGroupElement),
		enabled: exprExpr('!!$(this:page_name) && toLowerCase($(this:page_name)) != "page" && $(this:page_name) != "$NA"'),
		children: [
			{
				...(CreateElementOfType('text') as ButtonGraphicsTextElement),
				text: exprVal('$(this:page_name)'),
				color: exprVal(0xffffff),
				fontsize: exprVal('30'),
			},
		],
	},

	{
		// No name, default display
		...(CreateElementOfType('group') as ButtonGraphicsGroupElement),
		enabled: exprExpr('!$(this:page_name) || toLowerCase($(this:page_name)) == "page" || $(this:page_name) == "$NA"'),
		children: [
			{
				...(CreateElementOfType('text') as ButtonGraphicsTextElement),
				text: exprVal('PAGE'),
				color: exprVal(0xffc600), // Yellow color
				fontsize: exprVal('16.5'),
				valign: exprVal('bottom'),
				height: exprVal(40),
			},
			{
				...(CreateElementOfType('text') as ButtonGraphicsTextElement),
				text: exprExpr('getVariable("this:page") || "x"'),
				color: exprVal(0xffffff),
				fontsize: exprVal('30'),
				valign: exprVal('top'),
				y: exprVal(45),
				height: exprVal(55),
			},
		],
	},
]

/**
 * Class for a pagenum button control.
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
export class ControlButtonPageNumber
	extends ControlBase<PageNumberButtonModel>
	implements
		ControlWithoutActions,
		ControlWithoutLayeredStyle,
		ControlWithoutEvents,
		ControlWithoutActionSets,
		ControlWithoutOptions,
		ControlWithoutPushed
{
	readonly type = 'pagenum'

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
	 * @param registry - the application core
	 * @param controlId - id of the control
	 * @param storage - persisted storage object
	 * @param isImport - if this is importing a button, not creating at startup
	 */
	constructor(deps: ControlDependencies, controlId: string, storage: PageNumberButtonModel | null, isImport: boolean) {
		super(deps, controlId, 'Controls/Button/PageNumber')

		if (!storage) {
			// New control

			// Save the change
			this.commitChange()

			// Notify interested
		} else {
			if (storage.type !== 'pagenum')
				throw new Error(`Invalid type given to ControlButtonPageNumber: "${storage.type}"`)

			if (isImport) this.commitChange()
		}
	}

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

	/**
	 * Get the complete style object of a button
	 * @returns the processed style of the button
	 */
	async getDrawStyle(): Promise<DrawStyleLayeredButtonModel | null> {
		const location = this.deps.pageStore.getLocationOfControlId(this.controlId)
		const parser = this.deps.variableValues.createVariablesAndExpressionParser(location, null, null)

		// Compute the new drawing, using the element conversion cache for per-element caching
		const { elements, usedVariables } = await ConvertSomeButtonGraphicsElementForDrawing(
			this.deps.instance.definitions,
			parser,
			this.deps.graphics.renderPixelBuffers.bind(this.deps.graphics),
			pageNumberElements,
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
			drawType: 'pagenum',
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

	/**
	 * Execute a press of this control
	 * @param pressed Whether the control is pressed
	 * @param surfaceId The surface that initiated this press
	 */
	pressControl(pressed: boolean, surfaceId: string | undefined): void {
		if (pressed && surfaceId) {
			this.deps.surfaces.devicePageSet(surfaceId, this.deps.pageStore.getFirstPageId())
		}
	}

	/**
	 * Convert this control to JSON
	 * To be sent to the client and written to the db
	 * @param _clone - Whether to return a cloned object
	 */
	toJSON(_clone = true): PageNumberButtonModel {
		return {
			type: this.type,
		}
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
