export const HostApiNodeJsIpc = 'nodejs-ipc'

export type ResultCallback<T> = (err: any, res: T) => void

export interface ModuleToHostEventsInit {
	register: (msg: ModuleRegisterMessage) => void
}
export type HostToModuleEventsInit = Record<never, never>

export interface ModuleRegisterMessage {
	apiVersion: string
	connectionId: string
	verificationToken: string
}
