import type { PageDownButtonModel } from '@companion-app/shared/Model/ButtonModel.js'
import { exprExpr, exprVal } from '@companion-app/shared/Model/Options.js'
import type {
	ButtonGraphicsBoxElement,
	ButtonGraphicsGroupElement,
	ButtonGraphicsLineElement,
	ButtonGraphicsTextElement,
	SomeButtonGraphicsElement,
} from '@companion-app/shared/Model/StyleLayersModel.js'
import {
	ButtonGraphicsDecorationType,
	ButtonGraphicsElementUsage,
	ButtonGraphicsShowStatusIcons,
} from '@companion-app/shared/Model/StyleModel.js'
import type { ControlDependencies } from '../ControlDependencies.js'
import { CreateElementOfType } from './Button/LayerDefaults.js'
import { ControlButtonPage } from './PageButton.js'

export const pageDownElements: SomeButtonGraphicsElement[] = [
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
		// Draw the arrow
		...(CreateElementOfType('group') as ButtonGraphicsGroupElement),
		enabled: exprExpr('!$(internal:_graphics_page_plusminus)'),
		children: [
			{
				...(CreateElementOfType('line') as ButtonGraphicsLineElement),
				fromX: exprVal(64),
				fromY: exprVal(55),
				toX: exprVal(50),
				toY: exprVal(69),
				borderColor: exprVal(0xffffff),
				borderWidth: exprVal(2.5),
			},
			{
				...(CreateElementOfType('line') as ButtonGraphicsLineElement),
				fromX: exprVal(36),
				fromY: exprVal(55),
				toX: exprVal(50),
				toY: exprVal(69),
				borderColor: exprVal(0xffffff),
				borderWidth: exprVal(2.5),
			},
		],
	},

	{
		// Draw +/- if enabled
		...(CreateElementOfType('text') as ButtonGraphicsTextElement),
		enabled: exprExpr('$(internal:_graphics_page_plusminus)'),
		text: exprExpr('$(internal:_graphics_page_direction_flipped) ? "+" : "–"'),
		color: exprVal(0xffffff),
		fontsize: exprVal('30'),
		valign: exprVal('top'),
		y: exprVal(50),
		height: exprVal(50),
	},

	{
		...(CreateElementOfType('text') as ButtonGraphicsTextElement),
		text: exprVal('DOWN'),
		color: exprVal(0xffc600), // Yellow color
		fontsize: exprVal('16.5'),
		valign: exprVal('bottom'),
		height: exprVal(47),
	},
]

/**
 * Class for a pagedown button control.
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
export class ControlButtonPageDown extends ControlButtonPage<PageDownButtonModel> {
	readonly type = 'pagedown'

	/**
	 * @param registry - the application core
	 * @param controlId - id of the control
	 * @param storage - persisted storage object
	 * @param isImport - if this is importing a button, not creating at startup
	 */
	constructor(deps: ControlDependencies, controlId: string, storage: PageDownButtonModel | null, isImport: boolean) {
		super(deps, controlId, 'Controls/Button/Pagedown')

		if (!storage) {
			// New control

			// Save the change
			this.commitChange()

			// Notify interested
		} else {
			if (storage.type !== 'pagedown') throw new Error(`Invalid type given to ControlButtonPageDown: "${storage.type}"`)

			if (isImport) this.commitChange()
		}
	}

	protected getDrawElements(): ReturnType<ControlButtonPage<any>['getDrawElements']> {
		return {
			drawType: 'pagedown',
			elements: pageDownElements,
		}
	}

	/**
	 * Execute a press of this control
	 * @param pressed Whether the control is pressed
	 * @param surfaceId The surface that initiated this press
	 */
	pressControl(pressed: boolean, surfaceId: string | undefined): void {
		if (pressed && surfaceId) {
			this.deps.surfaces.devicePageDown(surfaceId)
		}
	}

	/**
	 * Convert this control to JSON
	 * To be sent to the client and written to the db
	 * @param _clone - Whether to return a cloned object
	 */
	toJSON(_clone = true): PageDownButtonModel {
		return {
			type: this.type,
		}
	}
}
