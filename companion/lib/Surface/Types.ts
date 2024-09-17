import type { CompanionSurfaceConfigField } from '@companion-app/shared/Model/Surfaces.js'
import type { ImageResult } from '../Graphics/ImageResult.js'
import type { EventEmitter } from 'events'
import type { GridSize } from './Util.js'
import type { CompanionVariableValue, CompanionVariableValues } from '@companion-module/base'

export type SurfacePanelFactory = {
	create: (path: string, options: LocalUSBDeviceOptions) => Promise<SurfacePanel>
}

export interface LocalUSBDeviceOptions {
	executeExpression: SurfaceExecuteExpressionFn
	useLegacyLayout?: boolean
}

export type SurfaceExecuteExpressionFn = (
	str: string,
	surfaceId: string,
	injectedVariableValues?: CompanionVariableValues
) => { value: CompanionVariableValue | undefined; variableIds: Set<string> }

export interface SurfacePanelInfo {
	deviceId: string
	devicePath: string
	type: string
	configFields: CompanionSurfaceConfigField[]
	location?: string
}
export interface SurfacePanel extends EventEmitter {
	readonly info: SurfacePanelInfo
	readonly gridSize: GridSize
	clearDeck(): void
	draw(x: number, y: number, render: ImageResult): void
	drawMany?: (entries: DrawButtonItem[]) => void
	drawColor?: (pageOffset: number, x: number, y: number, color: number) => void
	setConfig(config: any, force?: boolean): void
	getDefaultConfig?: () => any
	onVariablesChanged?: (allChangedVariables: Set<string>) => void
	quit(): void
}
export interface DrawButtonItem {
	x: number
	y: number
	image: ImageResult
}
