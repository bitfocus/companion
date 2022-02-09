export const HostApiSocketIo = 'socket.io'

export type ResultCallback<T> = (err: any, res: T) => void

export interface ModuleToHostEventsInit {
	register: (apiVersion: string, connectionId: string, socketIoToken: string, cb: () => void) => void
}
export type HostToModuleEventsInit = Record<never, never>
