import type { AppInfo } from '../Registry.js'
import type { IPageStore } from '../Page/Store.js'
import type { ControlsController } from '../Controls/Controller.js'
import type { SurfaceController } from '../Surface/Controller.js'
import type { VariablesController } from '../Variables/Controller.js'
import { VariablesValuesEvents } from '../Variables/Values.js'
import { VariablesCustomVariableEvents } from '../Variables/CustomVariable.js'
import type { CompanionVariableValue } from '@companion-module/base'
import type { ControlLocation } from '@companion-app/shared/Model/Common.js'
import type { ImageResult } from '../Graphics/ImageResult.js'
import type { GraphicsController } from '../Graphics/Controller.js'
import type { ButtonStyleProperties } from '@companion-app/shared/Model/StyleModel.js'
import { ActionRecorderEvents } from '../Controls/ActionRecorder.js'
import { RecordSessionInfo } from '@companion-app/shared/Model/ActionRecorderModel.js'
import EventEmitter from 'events'

/**
 * Class providing an abstract api for consumption by services.
 *
 * @author Håkon Nessjøen <haakon@bitfocus.io>
 * @author Keith Rocheck <keith.rocheck@gmail.com>
 * @author William Viker <william@bitfocus.io>
 * @author Julian Waller <me@julusian.co.uk>
 * @since 4.0.0
 * @copyright 2025 Bitfocus AS
 * @license
 * This program is free software.
 * You should have received a copy of the MIT licence as well as the Bitfocus
 * Individual Contributor License Agreement for Companion along with
 * this program.
 */

type ServiceApiEvents =
	| Pick<VariablesValuesEvents, 'variables_changed'>
	| Pick<ActionRecorderEvents, 'action_recorder_is_running'>
	| Pick<VariablesCustomVariableEvents, 'custom_variable_definition_changed'>

export class ServiceApi extends EventEmitter<ServiceApiEvents> {
	readonly #appInfo: AppInfo
	readonly #pageStore: IPageStore
	readonly #controlController: ControlsController
	readonly #surfaceController: SurfaceController
	readonly #variablesController: VariablesController
	readonly #graphicsController: GraphicsController

	get appInfo(): AppInfo {
		return this.#appInfo
	}

	constructor(
		appInfo: AppInfo,
		pageStore: IPageStore,
		controlController: ControlsController,
		surfaceController: SurfaceController,
		variablesController: VariablesController,
		graphicsController: GraphicsController
	) {
		super()
		this.#appInfo = appInfo
		this.#pageStore = pageStore
		this.#controlController = controlController
		this.#surfaceController = surfaceController
		this.#variablesController = variablesController
		this.#graphicsController = graphicsController

		this.#controlController.actionRecorder.on('action_recorder_is_running', (...args) => {
			this.emit('action_recorder_is_running', ...args)
		})

		this.#variablesController.values.on('variables_changed', (...args) => {
			this.emit('variables_changed', ...args)
		})
		this.#variablesController.custom.on('custom_variable_definition_changed', (...args) => {
			this.emit('custom_variable_definition_changed', ...args)
		})
	}

	/**
	 * Set the value of a custom variable
	 * @param name
	 * @param value
	 * @returns Failure reason, if any
	 */
	setCustomVariableValue(name: string, value: CompanionVariableValue): string | null {
		return this.#variablesController.custom.setValue(name, value)
	}

	/**
	 * Get the value of a custom variable
	 * @param name
	 * @returns The value of the variable
	 */
	getCustomVariableValue(name: string): CompanionVariableValue | undefined {
		return this.#variablesController.custom.getValue(name)
	}

	/**
	 * Get the description of a custom variable
	 * @param name
	 * @returns The description of the variable
	 */

	getCustomVariableDescription(name: string): string {
		return this.#variablesController.custom.getVariableDescription(name)
	}

	/**
	 * Get the value of a connection variable
	 * @param connectionLabel
	 * @param variableName
	 * @returns The value of the variable
	 */
	getConnectionVariableValue(connectionLabel: string, variableName: string): CompanionVariableValue | undefined {
		return this.#variablesController.values.getVariableValue(connectionLabel, variableName)
	}

	/**
	 * Get the description of a connection variable
	 * @param connectionLabel
	 * @param variableName
	 * @returns The description of the variable
	 */

	getConnectionVariableDescription(connectionLabel: string, variableName: string): string | undefined {
		return this.#variablesController.definitions.getVariableLabel(connectionLabel, variableName)
	}

	/**
	 * Get the a connections defined variable names
	 * @param connectionLabel
	 * @returns Array of defined variable names
	 */
	getConnectionVariableDefinitions(connectionLabel: string): string[] | undefined {
		return this.#variablesController.values.getVariableDefinitions(connectionLabel)
	}

	/**
	 * Get the a defined custom variable names
	 * @returns Array of defined variable names
	 */
	getCustomVariableDefinitions(): string[] | undefined {
		return this.#variablesController.values.getVariableDefinitions('custom')
	}

	async triggerRescanForSurfaces(): Promise<void> {
		await this.#surfaceController.triggerRefreshDevices()
	}

	/**
	 * Get the if of the control at the given page and bank index
	 */
	getControlIdAtOldBankIndex(page: number, bank: number): string | null {
		return this.#pageStore.getControlIdAtOldBankIndex(page, bank)
	}

	/**
	 * Get the id of the control at the given location
	 */
	getControlIdAt(location: ControlLocation): string | null {
		return this.#pageStore.getControlIdAt(location)
	}

	pressControl(controlId: string, pressed: boolean, surfaceId: string): boolean {
		return this.#controlController.pressControl(controlId, pressed, surfaceId)
	}

	rotateControl(controlId: string, direction: boolean, surfaceId: string): boolean {
		return this.#controlController.rotateControl(controlId, direction, surfaceId)
	}

	getControl(controlId: string): ServiceApiControl | null {
		const control = this.#controlController.getControl(controlId)
		if (!control) return null

		return {
			controlId,

			setCurrentStep: control.supportsActionSets ? (step) => control.actionSets.stepMakeCurrent(step) : undefined,

			setStyleFields: control.supportsLayeredStyle
				? (diff) => control.layeredStyleUpdateFromLegacyProperties(diff)
				: control.supportsStyle
					? (diff) => control.styleSetFields(diff)
					: undefined,
		}
	}

	/**
	 * Get the page id for a given page number
	 */
	getPageIdForNumber(pageNumber: number): string | null {
		return this.#pageStore.getPageInfo(pageNumber)?.id ?? null
	}

	getPageNumberForId(pageId: string): number | null {
		return this.#pageStore.getPageNumber(pageId)
	}

	getFirstPageId(): string {
		return this.#pageStore.getFirstPageId()
	}

	surfaceSetPage(surfaceId: string, pageId: string): void {
		this.#surfaceController.devicePageSet(surfaceId, pageId)
	}

	surfacePageUp(surfaceId: string): void {
		this.#surfaceController.devicePageUp(surfaceId)
	}
	surfacePageDown(surfaceId: string): void {
		this.#surfaceController.devicePageDown(surfaceId)
	}

	getCachedRenderOrGeneratePlaceholder(location: ControlLocation): ImageResult {
		return this.#graphicsController.getCachedRenderOrGeneratePlaceholder(location)
	}

	getCachedRender(location: ControlLocation): ImageResult | undefined {
		return this.#graphicsController.getCachedRender(location)
	}

	actionRecorderDiscardActions(): void {
		this.#controlController.actionRecorder.discardActions()
	}

	actionRecorderSetRecording(isRunning: boolean): void {
		this.#controlController.actionRecorder.setRecording(isRunning)
	}

	actionRecorderGetSession(): RecordSessionInfo {
		return this.#controlController.actionRecorder.getSession()
	}
}

export interface ServiceApiControl {
	readonly controlId: string

	setCurrentStep: ((step: number) => boolean) | undefined

	setStyleFields: ((diff: Partial<ButtonStyleProperties>) => void) | undefined
}
