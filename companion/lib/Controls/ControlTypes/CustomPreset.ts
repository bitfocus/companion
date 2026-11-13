import type { CustomPresetControlId } from '@companion-app/shared/ControlId.js'
import { diffObject } from '@companion-app/shared/Diff.js'
import type { LayeredButtonModel } from '@companion-app/shared/Model/ButtonModel.js'
import {
	convertCustomPresetToButtonModel,
	CustomPresetOptionsSchema,
	type ClientCustomPresetData,
	type CustomPresetModel,
	type CustomPresetOptions,
} from '@companion-app/shared/Model/CustomPresetModel.js'
import type { KeyValueChange } from '@companion-app/shared/Util/KeyValue.js'
import type { ControlDependencies } from '../ControlDependencies.js'
import { ControlButtonLayered } from './Button/Layered.js'
import { LayeredButtonControlBase } from './Button/LayeredBase.js'

/**
 * Class for a custom preset: a button built by the user, which is offered in the presets list to be placed onto the
 * grid as a copy, or as a linked preset which follows changes made to it.
 *
 * It is a layered button which is not on the grid, so it is edited like any other button, and its feedbacks are live so
 * that the editor shows the state it would be drawn in.
 *
 * @author Julian Waller <me@julusian.co.uk>
 * @copyright 2026 Bitfocus AS
 * @license
 * This program is free software.
 * You should have received a copy of the MIT licence as well as the Bitfocus
 * Individual Contributor License Agreement for Companion along with
 * this program.
 */
export class ControlCustomPreset extends LayeredButtonControlBase<
	CustomPresetControlId,
	CustomPresetModel,
	CustomPresetOptions
> {
	readonly type = 'custom-preset'

	/**
	 * The last sent custom preset json object
	 */
	#lastSentClientJson: ClientCustomPresetData | null = null

	/**
	 * @param deps - the control dependencies
	 * @param controlId - id of the control
	 * @param storage - persisted storage object
	 * @param isImport - if this is importing a custom preset, not creating at startup
	 */
	constructor(
		deps: ControlDependencies,
		controlId: CustomPresetControlId,
		storage: CustomPresetModel | null,
		isImport: boolean
	) {
		super(deps, controlId, `Controls/ControlTypes/CustomPreset/${controlId}`, CustomPresetOptionsSchema)

		if (!storage) {
			// New control
			this.drawing.loadElements(structuredClone(ControlButtonLayered.DefaultElements))

			this.commitChange()
			this.sendRuntimePropsChange()
		} else {
			if (storage.type !== 'custom-preset')
				throw new Error(`Invalid type given to ControlCustomPreset: "${storage.type}"`)

			this.loadButtonStorage(storage, isImport)
			if (!isImport) this.commitChange()
		}
	}

	checkCollectionIdIsValid(validCollectionIds: ReadonlySet<string>): boolean {
		if (this.options.collectionId && !validCollectionIds.has(this.options.collectionId)) {
			// collectionId is not valid, remove it
			this.options.collectionId = undefined

			this.commitChange(false)

			return true
		}

		return false
	}

	/**
	 * Update an option field of this control
	 */
	override optionsSetField(change: KeyValueChange<CustomPresetOptions>, forceSet?: boolean): boolean {
		if (!forceSet && (change.key === 'sortOrder' || change.key === 'collectionId'))
			throw new Error('sortOrder cannot be set by the client')

		return super.optionsSetField(change)
	}

	/**
	 * The button this preset places
	 */
	toButtonModel(): LayeredButtonModel {
		return convertCustomPresetToButtonModel(this.toJSON())
	}

	/**
	 * Convert this control to JSON
	 * To be sent to the client and written to the db
	 */
	override toJSON(): CustomPresetModel {
		return {
			type: this.type,
			options: this.options,
			...this.buttonBodyToJSON(),
		}
	}

	toClientJSON(): ClientCustomPresetData {
		return {
			type: this.type,
			name: this.options.name,
			description: this.options.description,
			sortOrder: this.options.sortOrder,
			collectionId: this.options.collectionId,
		}
	}

	/**
	 * Emit a change to the client json of this control.
	 */
	#sendClientJsonChange(): void {
		const newJson = structuredClone(this.toClientJSON())

		if (this.deps.changeEvents.listenerCount('customPresetChange') > 0) {
			if (this.#lastSentClientJson) {
				const patch = diffObject(this.#lastSentClientJson, newJson)
				if (patch.length > 0) {
					this.deps.changeEvents.emit('customPresetChange', this.controlId, {
						type: 'update',
						controlId: this.controlId,
						patch,
					})
				}
			} else {
				this.deps.changeEvents.emit('customPresetChange', this.controlId, {
					type: 'add',
					controlId: this.controlId,
					info: newJson,
				})
			}
		}

		this.#lastSentClientJson = newJson
	}

	override commitChange(redraw = true): void {
		super.commitChange(redraw)

		this.#sendClientJsonChange()

		this.deps.events.emit('customPresetDefinitionChanged', this.controlId)
	}

	override destroy(): void {
		super.destroy()

		this.deps.events.emit('customPresetDefinitionChanged', this.controlId)

		if (this.deps.changeEvents.listenerCount('customPresetChange') > 0) {
			this.deps.changeEvents.emit('customPresetChange', this.controlId, {
				type: 'remove',
				controlId: this.controlId,
			})
		}
	}
}
