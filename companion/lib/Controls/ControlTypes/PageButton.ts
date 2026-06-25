import { nanoid } from 'nanoid'
import type { LayeredButtonModel, SomeButtonModel } from '@companion-app/shared/Model/ButtonModel.js'
import { EntityModelType } from '@companion-app/shared/Model/EntityModel.js'
import type { ExpressionableOptionsObject } from '@companion-app/shared/Model/Options.js'
import type { SomeButtonGraphicsElement } from '@companion-app/shared/Model/StyleLayersModel.js'
import { type DrawStyleLayeredButtonModel } from '@companion-app/shared/Model/StyleModel.js'
import { ControlBase } from '../ControlBase.js'
import type { ControlDependencies } from '../ControlDependencies.js'
import type {
	ControlWithConvert,
	ControlWithoutActions,
	ControlWithoutActionSets,
	ControlWithoutEvents,
	ControlWithoutLayeredStyle,
	ControlWithoutOptions,
	ControlWithoutPushed,
} from '../IControlFragments.js'
import { LayeredButtonDrawer } from './Button/LayeredButtonDrawer.js'

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
		ControlWithConvert,
		ControlWithoutActions,
		ControlWithoutLayeredStyle,
		ControlWithoutEvents,
		ControlWithoutActionSets,
		ControlWithoutOptions,
		ControlWithoutPushed
{
	readonly supportsActions = false
	readonly supportsConvert = true
	readonly supportsEntities = false
	readonly supportsLayeredStyle = false
	readonly supportsEvents = false
	readonly supportsActionSets = false
	readonly supportsOptions = false
	readonly supportsPushed = false

	readonly #drawing: LayeredButtonDrawer
	override get drawing(): LayeredButtonDrawer {
		return this.#drawing
	}

	protected triggerInvalidation = (): void => {
		this.#drawing.invalidate()
	}

	constructor(deps: ControlDependencies, controlId: string, debugNamespace: string) {
		super(deps, controlId, debugNamespace)

		const { drawType, elements } = this.getDrawElements()
		this.#drawing = new LayeredButtonDrawer(
			deps,
			controlId,
			{
				getButtonStateProps: () => ({
					pushed: false,
					stepCurrent: 0,
					stepCount: 0,
					button_status: undefined,
					action_running: undefined,
				}),
				entities: null,
			},
			drawType
		)
		this.#drawing.loadElements(structuredClone(elements))
	}

	/**
	 * Prepare this control for deletion
	 */
	destroy(): void {
		this.#drawing.dispose()
		super.destroy()
	}

	protected abstract getDrawElements(): {
		drawType: DrawStyleLayeredButtonModel['drawType']
		elements: SomeButtonGraphicsElement[]
	}

	/**
	 * Collect the connection ids, labels, and variables referenced by this control
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
		this.#drawing.locationChanged()
	}

	renameVariables(_labelFrom: string, _labelTo: string): void {
		// Nothing to do
	}

	abstract convertControl(): SomeButtonModel

	// in ControlButtonPage
	protected buildConvertedControl(
		elements: SomeButtonGraphicsElement[],
		action: { definitionId: string; options: ExpressionableOptionsObject }
	): LayeredButtonModel {
		return {
			type: 'button-layered',
			options: { stepProgression: 'auto', rotaryActions: false, canModifyStyleInApis: false },
			style: { layers: structuredClone(elements) },
			feedbacks: [],
			steps: {
				'0': {
					action_sets: {
						down: [
							{
								type: EntityModelType.Action,
								id: nanoid(),
								definitionId: action.definitionId,
								connectionId: 'internal',
								options: action.options,
								upgradeIndex: undefined,
							},
						],
						up: undefined,
						rotate_left: undefined,
						rotate_right: undefined,
					},
					options: { runWhileHeld: [] },
				},
			},
			localVariables: [],
		}
	}
}
