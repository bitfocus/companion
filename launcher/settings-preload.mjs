// Preload script for the settings window

import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('api', {
	send: (channel, data) => {
		// whitelist channels
		const validChannels = ['info']
		if (validChannels.includes(channel)) {
			ipcRenderer.send(channel, data)
		}
	},
	receive: (channel, func) => {
		// whitelist channels
		const validChannels = ['info', 'config-error']
		if (validChannels.includes(channel)) {
			// Deliberately strip event as it includes `sender`
			ipcRenderer.on(channel, (event, ...args) => func(...args))
		}
	},
})
