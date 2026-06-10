import type { LayeredButtonModel, PageNumberButtonModel } from '@companion-app/shared/Model/ButtonModel.js'
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
} from '@companion-app/shared/Model/StyleModel.js'
import type { ControlDependencies } from '../ControlDependencies.js'
import { CreateElementOfType } from './Button/LayerDefaults.js'
import { ControlButtonPage } from './PageButton.js'

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
				fontsize: exprVal(30),
				fontsizeAllowShrink: exprVal(false),
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
				fontsize: exprVal(16.5),
				fontsizeAllowShrink: exprVal(false),
				valign: exprVal('bottom'),
				height: exprVal(40),
			},
			{
				...(CreateElementOfType('text') as ButtonGraphicsTextElement),
				text: exprExpr('getVariable("this:page") || "x"'),
				color: exprVal(0xffffff),
				fontsize: exprVal(30),
				fontsizeAllowShrink: exprVal(true),
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
export class ControlButtonPageNumber extends ControlButtonPage<PageNumberButtonModel> {
	readonly type = 'pagenum'

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

	protected getDrawElements(): ReturnType<ControlButtonPage<any>['getDrawElements']> {
		return {
			drawType: 'pagenum',
			elements: pageNumberElements,
		}
	}

	/**
	 * Execute a press of this control
	 * @param pressed Whether the control is pressed
	 * @param surfaceId The surface that initiated this press
	 */
	pressControl(pressed: boolean, surfaceId: string | undefined): void {
		if (pressed && surfaceId) {
			const startupPageId = this.deps.surfaces.devicePageGetConfiguredStartup(surfaceId)
			const pageId =
				startupPageId && this.deps.pageStore.isPageIdValid(startupPageId)
					? startupPageId
					: this.deps.pageStore.getFirstPageId()
			this.deps.surfaces.devicePageSet(surfaceId, pageId)
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

	convertControl(): LayeredButtonModel {
		return this.buildConvertedControl(pageNumberElements, {
			definitionId: 'set_page',
			options: {
				surfaceId: exprVal('self'),
				page: exprVal('startup'),
			},
		})
	}
}
