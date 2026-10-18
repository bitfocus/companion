// Fix fontsource css imports
declare module '@fontsource/*' {}
declare module '@fontsource-variable/*' {}

// The IPC bridge exposed by the launcher's preload scripts
interface Window {
	api: {
		send: (channel: string, data?: any) => void
		/** Returns a function that removes the listener */
		receive: (channel: string, func: (...args: any[]) => void) => () => void
	}
}
