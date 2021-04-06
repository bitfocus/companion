import '@fontsource/roboto'
import './App.scss'

import React from 'react'
import ReactDOM from 'react-dom'
import { BrowserRouter, Redirect, Route, Switch } from 'react-router-dom'
import App from './App'
import reportWebVitals from './reportWebVitals'

import i18n from 'i18next'
import Backend from 'i18next-http-backend'
import LanguageDetector from 'i18next-browser-languagedetector'
import { initReactI18next } from 'react-i18next'
import { GettingStarted } from './GettingStarted'
import { Tablet } from './Tablet'
import { Emulator } from './Emulator'

i18n
	.use(Backend)
	.use(LanguageDetector)
	.use(initReactI18next) // passes i18n down to react-i18next
	.init({
		lng: 'en',
		fallbackLng: 'en',

		// debug: true, // TODO disable

		interpolation: {
			escapeValue: false,
		},
	})

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
			<Switch>
				<Redirect from="/help.html" to="/getting-started" />
				<Route path="/getting-started">
					<GettingStarted />
				</Route>

				<Route path="/emulator">
					<Emulator />
				</Route>
				<Redirect from="/emulator2" to="/emulator" />
				<Redirect from="/emulator.html" to="/emulator" />

				{/* TODO this needs some work, to translate the query strings to the new format */}
				{/* {RedirectPreserveQuery('/tablet.html', '/tablet')} */}
				{/* <Redirect from="/tablet.html" to="/tablet" />
				<Redirect from="/tablet2.html" to="/tablet" />
				<Redirect from="/ipad.html" to="/tablet" />
				<Redirect from="/tablet34" to="/tablet" /> */}
				<Route path="/tablet3">
					<Tablet />
				</Route>
				<Route>
					<App />
				</Route>
			</Switch>
		</BrowserRouter>
	</React.StrictMode>,
	document.getElementById('root')
)

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals()
