export interface ActionInstance {
	id: string
	instance: string
	headline?: string
	action: string
	options: Record<string, any>
	delay: number
	disabled?: boolean
	upgradeIndex?: number

	children?: ActionInstance[]
}

export interface ActionStepOptions {
	runWhileHeld: number[]
	name?: string
}

// TODO - type better?
export type ActionSetsModel = Record<string | number, ActionInstance[] | undefined>
//  {
// 	down: ActionInstance[]
// 	up: ActionInstance[]
// 	rotate_left?: ActionInstance[]
// 	rotate_right?: ActionInstance[]

// 	[duration: number]: ActionInstance[] | undefined
// }

// export type ActionSetId = 'down' | 'up' | 'rotate_left' | 'rotate_right' | number
