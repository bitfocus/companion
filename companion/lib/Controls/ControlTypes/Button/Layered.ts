import type { BankControlId } from '@companion-app/shared/ControlId.js'
import {
	FONTSIZE_SHRINK_DEFAULT,
	getDefaultPinnedProperties,
} from '@companion-app/shared/Graphics/ElementPropertiesSchemas.js'
import {
	LayeredButtonOptionsSchema,
	type LayeredButtonModel,
	type LayeredButtonOptions,
} from '@companion-app/shared/Model/ButtonModel.js'
import type { SomeButtonGraphicsElement } from '@companion-app/shared/Model/StyleLayersModel.js'
import {
	ButtonGraphicsDecorationType,
	ButtonGraphicsElementUsage,
	ButtonGraphicsShowStatusIcons,
} from '@companion-app/shared/Model/StyleModel.js'
import type { ControlDependencies } from '../../ControlDependencies.js'
import { LayeredButtonControlBase } from './LayeredBase.js'

/**
 * Class for the button control with layer based rendering, placed on the grid.
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
export class ControlButtonLayered extends LayeredButtonControlBase<
	BankControlId,
	LayeredButtonModel,
	LayeredButtonOptions
> {
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
			pinnedProperties: getDefaultPinnedProperties('box'),
			enabled: { value: true, isExpression: false },
			opacity: { value: 100, isExpression: false },
			x: { value: 0, isExpression: false },
			y: { value: 0, isExpression: false },
			width: { value: 100, isExpression: false },
			height: { value: 100, isExpression: false },
			rotation: { value: 0, isExpression: false },
			color: { value: 0x000000, isExpression: false },
			cornerRadius: { value: 0, isExpression: false },
			borderWidth: { value: 0, isExpression: false },
			borderColor: { value: 0, isExpression: false },
			borderPosition: { value: 'inside', isExpression: false },
		},
		{
			id: 'text0',
			name: 'Text',
			usage: ButtonGraphicsElementUsage.Automatic,
			type: 'text',
			pinnedProperties: getDefaultPinnedProperties('text'),
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

	constructor(
		deps: ControlDependencies,
		controlId: BankControlId,
		storage: LayeredButtonModel | null,
		isImport: boolean
	) {
		super(deps, controlId, `Controls/Button/Normal/${controlId}`, LayeredButtonOptionsSchema)

		if (!storage) {
			// New control
			this.drawing.loadElements(structuredClone(ControlButtonLayered.DefaultElements))

			this.commitChange()
			this.sendRuntimePropsChange()
		} else {
			if (storage.type !== 'button-layered')
				throw new Error(`Invalid type given to ControlButtonLayered: "${storage.type}"`)

			this.loadButtonStorage(storage, isImport)
		}
	}

	/**
	 * Convert this control to JSON
	 * To be sent to the client and written to the db
	 */
	override toJSON(): LayeredButtonModel {
		return {
			type: this.type,
			options: this.options,
			...this.buttonBodyToJSON(),
		}
	}
}
