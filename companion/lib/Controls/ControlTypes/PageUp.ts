import { PageUpButtonModel } from '@companion-app/shared/Model/ButtonModel.js'
import { ControlBase } from '../ControlBase.js'
import type {
	ControlWithoutActionSets,
	ControlWithoutActions,
	ControlWithoutEvents,
	ControlWithoutLayeredStyle,
	ControlWithoutOptions,
	ControlWithoutPushed,
	ControlWithoutStyle,
} from '../IControlFragments.js'
import type { DrawStyleModel } from '@companion-app/shared/Model/StyleModel.js'
import type { ControlDependencies } from '../ControlDependencies.js'

/**
 * Class for a pageup button control.
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
export class ControlButtonPageUp
	extends ControlBase<PageUpButtonModel>
	implements
		ControlWithoutActions,
		ControlWithoutStyle,
		ControlWithoutLayeredStyle,
		ControlWithoutEvents,
		ControlWithoutActionSets,
		ControlWithoutOptions,
		ControlWithoutPushed
{
	readonly type = 'pageup'

	readonly supportsActions = false
	readonly supportsEntities = false
	readonly supportsStyle = false
	readonly supportsLayeredStyle = false
	readonly supportsEvents = false
	readonly supportsActionSets = false
	readonly supportsOptions = false
	readonly supportsPushed = false

	/**
	 * @param registry - the application core
	 * @param controlId - id of the control
	 * @param storage - persisted storage object
	 * @param isImport - if this is importing a button, not creating at startup
	 */
	constructor(deps: ControlDependencies, controlId: string, storage: PageUpButtonModel | null, isImport: boolean) {
		super(deps, controlId, 'Controls/Button/PageUp')

		if (!storage) {
			// New control

			// Save the change
			this.commitChange()

			// Notify interested
		} else {
			if (storage.type !== 'pageup') throw new Error(`Invalid type given to ControlButtonPageUp: "${storage.type}"`)

			if (isImport) this.commitChange()
		}
	}

	/**
	 * Get the complete style object of a button
	 * @returns the processed style of the button
	 */
	getLastDrawStyle(): DrawStyleModel {
		return {
			style: 'pageup',
		}
	}

	/**
	 * Collect the connection ids and labels referenced by this control
	 * @param foundConnectionIds - connection ids being referenced
	 * @param foundConnectionLabels - connection labels being referenced
	 */
	collectReferencedConnections(_foundConnectionIds: Set<string>, _foundConnectionLabels: Set<string>) {
		// Nothing being referenced
	}

	/**
	 * Inform the control that it has been moved, and anything relying on its location must be invalidated
	 */
	triggerLocationHasChanged(): void {
		// Nothing to do
	}

	/**
	 * Execute a press of this control
	 * @param pressed Whether the control is pressed
	 * @param surfaceId The surface that initiated this press
	 */
	pressControl(pressed: boolean, surfaceId: string | undefined) {
		if (pressed && surfaceId) {
			this.deps.surfaces.devicePageUp(surfaceId)
		}
	}

	/**
	 * Convert this control to JSON
	 * To be sent to the client and written to the db
	 * @param _clone - Whether to return a cloned object
	 */
	toJSON(_clone = true): PageUpButtonModel {
		return {
			type: this.type,
		}
	}

	getBitmapFeedbackSize() {
		return null
	}
	renameVariables(_labelFrom: string, _labelTo: string) {
		// Nothing to do
	}
}
