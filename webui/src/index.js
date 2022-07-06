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
require('intersection-observer')

import React from 'react'
import ReactDOM from 'react-dom'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import App from './App'

// import i18n from 'i18next'
// import Backend from 'i18next-http-backend'
// import LanguageDetector from 'i18next-browser-languagedetector'
// import { initReactI18next } from 'react-i18next'
import { GettingStarted } from './GettingStarted'
import { Tablet } from './Tablet'
import { Emulator } from './Emulator'

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

// function RedirectPreserveQuery(from, to) {
// 	return (
// 		<Route
// 			path={from}
// 			component={({ location }) => (
// 				<Redirect
// 					to={{
// 						...location,
// 						pathname: location.pathname.replace(from, to),
// 					}}
// 				/>
// 			)}
// 		/>
// 	)
// }

ReactDOM.render(
	<React.StrictMode>
		<BrowserRouter>
			<Routes>
				<Route path="/help.html" element={<Navigate to="/getting-started" replace />} />
				<Route path="/getting-started" element={<GettingStarted />} />

				<Route path="/emulator" element={<Emulator />} />
				<Route path="/emulator2" element={<Navigate to="/emulator" replace />} />
				<Route path="/emulator.html" element={<Navigate to="/emulator" replace />} />

				{/* TODO this needs some work, to translate the query strings to the new format */}
				{/* {RedirectPreserveQuery('/tablet.html', '/tablet')} */}
				<Route path="/tablet.html" element={<Navigate to="/tablet" replace />} />
				<Route path="/tablet2.html" element={<Navigate to="/tablet" replace />} />
				<Route path="/ipad.html" element={<Navigate to="/tablet" replace />} />
				<Route path="/tablet3" element={<Navigate to="/tablet" replace />} />

				<Route path="/tablet" element={<Tablet />} />
				<Route path="/*" element={<App />} />
			</Routes>
		</BrowserRouter>
	</React.StrictMode>,
	document.getElementById('root')
)
