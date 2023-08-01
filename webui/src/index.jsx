/* eslint-disable import/first */

import '@fontsource/roboto'
import './App.scss'

if (process.env.NODE_ENV === 'development') {
	const defineProperties = Object.defineProperties
	Object.defineProperties = function (o, props) {
		return o === console ? o : defineProperties(o, props)
	}
}

// polyfills
import 'intersection-observer'

import React from 'react'
import ReactDOM from 'react-dom'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import io from 'socket.io-client'

import App from './App'
import { SocketContext } from './util'

// import i18n from 'i18next'
// import Backend from 'i18next-http-backend'
// import LanguageDetector from 'i18next-browser-languagedetector'
// import { initReactI18next } from 'react-i18next'
import { GettingStarted } from './GettingStarted'
import { TabletView } from './TabletView'
import { Emulator } from './Emulator/Emulator'
import { EmulatorList } from './Emulator/List'
import { ConnectionDebug } from './ConnectionDebug'

// i18n
// 	.use(Backend)
// 	.use(LanguageDetector)
// 	.use(initReactI18next) // passes i18n down to react-i18next
// 	.init({
// 		lng: 'en',
// 		fallbackLng: 'en',

// 		interpolation: {
// 			escapeValue: false,
// 		},
// 	})

const socket = new io()
if (window.location.hash && window.location.hash.includes('debug_socket')) {
	socket.onAny(function (name, ...data) {
		console.log('received event', name, data)
	})
}

ReactDOM.render(
	<React.StrictMode>
		<SocketContext.Provider value={socket}>
			<BrowserRouter>
				<Routes>
					<Route path="/help.html" element={<Navigate to="/getting-started" replace />} />
					<Route path="/getting-started" element={<GettingStarted />} />

					<Route path="/connection-debug/:id" element={<ConnectionDebug />} />

					<Route path="/emulator/:id" element={<Emulator />} />
					<Route path="/emulators" element={<EmulatorList />} />
					<Route path="/emulator" element={<Navigate to="/emulator/emulator" replace />} />
					<Route path="/emulator2" element={<Navigate to="/emulator/emulator" replace />} />
					<Route path="/emulator.html" element={<Navigate to="/emulator/emulator" replace />} />

					{/* TODO this needs some work, to translate the query strings to the new format */}
					{/* {RedirectPreserveQuery('/tablet.html', '/tablet')} */}
					<Route path="/tablet.html" element={<Navigate to="/tablet" replace />} />
					<Route path="/tablet2.html" element={<Navigate to="/tablet" replace />} />
					<Route path="/ipad.html" element={<Navigate to="/tablet" replace />} />
					<Route path="/tablet3" element={<Navigate to="/tablet" replace />} />

					<Route path="/tablet" element={<TabletView />} />
					<Route path="/*" element={<App />} />
				</Routes>
			</BrowserRouter>
		</SocketContext.Provider>
	</React.StrictMode>,
	document.getElementById('root')
)
