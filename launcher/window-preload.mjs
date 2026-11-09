// Electron doesn't allow for require to be called in the web context anymore, but this preload is run before then to allow us to load some bits in.

import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('api', {
	send: (channel, data) => {
		// whitelist channels
		ipcRenderer.send(channel, data)
	},
	receive: (channel, func) => {
		// Deliberately strip event as it includes `sender`
		const listener = (event, ...args) => func(...args)
		ipcRenderer.on(channel, listener)
		return () => ipcRenderer.removeListener(channel, listener)
	},
})
