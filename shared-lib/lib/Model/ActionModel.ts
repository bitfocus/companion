import type { SomeEntityModel } from './EntityModel.js'

export interface ActionStepOptions {
	runWhileHeld: number[]
	name?: string
}

export type ActionSetId = 'down' | 'up' | 'rotate_left' | 'rotate_right' | number
export type ActionSetsModel = Record<ActionSetId, SomeEntityModel[] | undefined>
