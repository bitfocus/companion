import type { Logger } from '../../Log/Controller.js'
import type express from 'express'
import type { InstanceStatus } from '../Status.js'
import type { InstanceConfig } from '@companion-app/shared/Model/Instance.js'
import type { ControlLocation } from '@companion-app/shared/Model/Common.js'
import type { InstanceDefinitions } from '../Definitions.js'
import type { IControlStore } from '../../Controls/IControlStore.js'
import type { ActionRecorder } from '../ActionRecorder.js'
import type { VariablesController } from '../../Variables/Controller.js'
import type { ServiceOscSender } from '../../Service/OscSender.js'
import type { InstanceSharedUdpManager } from './SharedUdpManager.js'
import type { ActionEntityModel, SomeEntityModel } from '@companion-app/shared/Model/EntityModel.js'
import type { ControlEntityInstance } from '../../Controls/Entities/EntityInstance.js'
import type { ExpressionableOptionsObject, SomeCompanionInputField } from '@companion-app/shared/Model/Options.js'
import type { ChildProcessHandlerBase } from '../ProcessManager.js'

export interface ConnectionChildHandlerDependencies {
	readonly controls: IControlStore
	readonly actionRecorder: ActionRecorder
	readonly variables: VariablesController
	readonly oscSender: ServiceOscSender

	readonly instanceDefinitions: InstanceDefinitions
	readonly instanceStatus: InstanceStatus
	readonly sharedUdpManager: InstanceSharedUdpManager

	readonly setConnectionConfig: (
		connectionId: string,
		config: unknown | null,
		secrets: unknown | null,
		newUpgradeIndex: number | null
	) => void
	readonly debugLogLine: (
		connectionId: string,
		time: number | null,
		source: string,
		level: string,
		message: string
	) => void
}

export interface ConnectionChildHandlerApi extends ChildProcessHandlerBase {
	logger: Logger

	readonly connectionId: string

	hasRecordActionsHandler: boolean
	usesNewConfigLayout: boolean

	/**
	 * Forward an updated config object to the instance class
	 */
	updateConfigAndLabel(config: InstanceConfig): Promise<void>
	/**
	 * Fetch the config fields from the instance to show in the ui
	 */
	requestConfigFields(): Promise<SomeCompanionInputField[]>

	/**
	 * Send all feedback instances to the child process
	 * @access public - needs to be re-run when the topbar setting changes
	 */
	sendAllFeedbackInstances(): Promise<void>

	/**
	 * Send the list of changed variables to the child process
	 * @access public - called whenever variables change
	 */
	sendVariablesChanged(
		changedVariableIdSet: ReadonlySet<string>,
		changedVariableIds: string[],
		fromControlId: string | null
	): Promise<void>

	entityUpdate(entity: ControlEntityInstance, controlId: string): Promise<void>

	/**
	 *
	 */
	entityLearnValues(entity: SomeEntityModel, controlId: string): Promise<ExpressionableOptionsObject | undefined | void>

	/**
	 * Inform the child instance class about an entity that has been deleted
	 */
	entityDelete(oldEntity: SomeEntityModel): Promise<void>

	/**
	 * Tell the child instance class to execute an action
	 */
	actionRun(action: ActionEntityModel, extras: RunActionExtras): Promise<void>

	/**
	 *
	 */
	executeHttpRequest(req: express.Request, res: express.Response): void

	/**
	 * Inform the child instance class to start or stop recording actions
	 */
	startStopRecordingActions(recording: boolean): Promise<void>
}

export interface RunActionExtras {
	controlId: string
	surfaceId: string | undefined
	location: ControlLocation | undefined
	abortDelayed: AbortSignal
	executionMode: 'sequential' | 'concurrent'
}
