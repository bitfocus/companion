import type {
	CompanionSurfaceConfigField,
	GridSize,
	SurfaceFirmwareUpdateInfo,
	SurfaceGroupConfig,
	SurfacePanelConfig,
	SurfacesUpdate,
} from '@companion-app/shared/Model/Surfaces.js'
import type { ImageResult } from '../Graphics/ImageResult.js'
import type { EventEmitter } from 'events'
import type { CompanionVariableValue, CompanionVariableValues } from '@companion-module/base'
import type { ControlsController } from '../Controls/Controller.js'
import type { DataUserConfig } from '../Data/UserConfig.js'
import type { GraphicsController } from '../Graphics/Controller.js'
import type { IPageStore } from '../Page/Store.js'
import type { VariablesController } from '../Variables/Controller.js'
import type { ExecuteExpressionResult } from '@companion-app/shared/Expression/ExpressionResult.js'
import type { EmulatorPageConfig, EmulatorListItem } from '@companion-app/shared/Model/Emulator.js'
import type { EmulatorUpdateEvents } from './IP/ElgatoEmulator.js'

export type SurfacePanelFactory = {
	create: (path: string, options: LocalUSBDeviceOptions) => Promise<SurfacePanel>
}

export interface LocalUSBDeviceOptions {
	executeExpression: SurfaceExecuteExpressionFn
}

export type SurfaceExecuteExpressionFn = (
	str: string,
	surfaceId: string,
	injectedVariableValues?: CompanionVariableValues
) => ExecuteExpressionResult

export interface SurfacePanelInfo {
	deviceId: string
	devicePath: string
	type: string
	configFields: CompanionSurfaceConfigField[]
	location?: string
	firmwareUpdateVersionsUrl?: string
	hasFirmwareUpdates?: SurfaceFirmwareUpdateInfo
}

export interface SurfacePanel extends EventEmitter<SurfacePanelEvents> {
	readonly info: SurfacePanelInfo
	readonly gridSize: GridSize
	clearDeck(): void
	draw(x: number, y: number, render: ImageResult): void
	drawMany?: (entries: DrawButtonItem[]) => void
	setConfig(config: any, force?: boolean): void
	getDefaultConfig?: () => any
	onVariablesChanged?: (allChangedVariables: Set<string>) => void
	quit(): void
	checkForFirmwareUpdates?: (latestVersions?: unknown) => Promise<void>

	/**
	 * If the surface will handle locking display of the locking state itself, this method should be implemented.
	 * If defined, it will be called when the lock state changes.
	 */
	setLocked?: (locked: boolean, characterCount: number) => void
}

export interface DrawButtonItem {
	x: number
	y: number
	image: ImageResult
}

export interface SurfacePanelEvents {
	remove: []
	error: [error: Error]

	click: [x: number, y: number, pressed: boolean, pageOffset?: number]
	rotate: [x: number, y: number, rightward: boolean, pageOffset?: number]
	changePage: [forward: boolean]
	pincodeKey: [key: number]

	setCustomVariable: [variableId: string, value: CompanionVariableValue]

	resized: []
}

export interface SurfaceHandlerDependencies {
	/**
	 * The core controls controller
	 */
	readonly controls: ControlsController
	/**
	 * The core graphics controller
	 */
	readonly graphics: GraphicsController
	/**
	 * The core page controller
	 */
	readonly pageStore: IPageStore
	/**
	 * The core user config manager
	 */
	readonly userconfig: DataUserConfig
	/**
	 * The core variable controller
	 */
	readonly variables: VariablesController
}

export type UpdateEvents = EmulatorUpdateEvents & {
	emulatorPageConfig: [info: EmulatorPageConfig]
	emulatorList: [list: EmulatorListItem[]]

	surfaces: [changes: SurfacesUpdate[]]

	[id: `groupConfig:${string}`]: [config: SurfaceGroupConfig | null]
	[id: `surfaceConfig:${string}`]: [config: SurfacePanelConfig | null]
}
