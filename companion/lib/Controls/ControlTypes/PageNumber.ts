import { ControlBase } from '../ControlBase.js'
import type {
	ControlWithoutActionSets,
	ControlWithoutActions,
	ControlWithoutEvents,
	ControlWithoutOptions,
	ControlWithoutPushed,
	ControlWithoutStyle,
} from '../IControlFragments.js'
import type { DrawStyleModel } from '@companion-app/shared/Model/StyleModel.js'
import type { PageNumberButtonModel } from '@companion-app/shared/Model/ButtonModel.js'
import type { ControlDependencies } from '../ControlDependencies.js'

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
		ControlWithoutStyle,
		ControlWithoutEvents,
		ControlWithoutActionSets,
		ControlWithoutOptions,
		ControlWithoutPushed
{
	readonly type = 'pagenum'

	readonly supportsActions = false
	readonly supportsEntities = false
	readonly supportsStyle = false
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
	 * Get the complete style object of a button
	 * @returns the processed style of the button
	 */
	getDrawStyle(): DrawStyleModel {
		return {
			style: 'pagenum',
		}
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
		// Nothing to do
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

	getBitmapSize(): { width: number; height: number } | null {
		return null
	}
	renameVariables(_labelFrom: string, _labelTo: string): void {
		// Nothing to do
	}
}
