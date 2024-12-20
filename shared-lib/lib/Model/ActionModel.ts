import { SomeEntityModel } from './EntityModel.js'

export interface ActionInstance {
	id: string
	instance: string
	headline?: string
	action: string
	options: Record<string, any>
	disabled?: boolean
	upgradeIndex?: number

	/**
	 * Some internal actions can have children, one or more set of them
	 */
	children?: Record<string, ActionInstance[] | undefined>
}

export interface ActionStepOptions {
	runWhileHeld: number[]
	name?: string
}

export type ActionSetId = 'down' | 'up' | 'rotate_left' | 'rotate_right' | number

// TODO - type better?
export type ActionSetsModel = Record<ActionSetId, SomeEntityModel[] | undefined>
//  {
// 	down: ActionInstance[]
// 	up: ActionInstance[]
// 	rotate_left?: ActionInstance[]
// 	rotate_right?: ActionInstance[]

// 	[duration: number]: ActionInstance[] | undefined
// }

// export type ActionSetId = 'down' | 'up' | 'rotate_left' | 'rotate_right' | number
