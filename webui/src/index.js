import '@fontsource/roboto'
import './App.scss'

import React from 'react'
import ReactDOM from 'react-dom'
import { BrowserRouter, Route, Switch } from 'react-router-dom'
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

ReactDOM.render(
	<React.StrictMode>
		<BrowserRouter>
			<Switch>
				<Route path="/getting-started">
					<GettingStarted />
				</Route>
				<Route path="/emulator2">
					<Emulator />
				</Route>
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
