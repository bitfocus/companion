/* eslint-disable import/first */

import '@fontsource/roboto'
import '@fontsource/fira-code'
import './App.scss'
import './Constants.js'

if (process.env.NODE_ENV === 'development') {
	const defineProperties = Object.defineProperties
	Object.defineProperties = function (o, props) {
		return o === console ? o : defineProperties(o, props)
	}
}

// polyfills
import 'intersection-observer'

import React from 'react'
import { createRoot } from 'react-dom/client'
import io from 'socket.io-client'
import { RouterProvider, createRouter } from '@tanstack/react-router'

import { SocketContext, wrapSocket } from './util.js'

// import i18n from 'i18next'
// import Backend from 'i18next-http-backend'
// import LanguageDetector from 'i18next-browser-languagedetector'
// import { initReactI18next } from 'react-i18next'

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

// Import the generated route tree
import { routeTree } from './routeTree.gen.js'

// Create a new router instance
const router = createRouter({ routeTree })

// Register the router instance for type safety
declare module '@tanstack/react-router' {
	interface Register {
		router: typeof router
	}
}

const socket = io()
const socketWrapped = wrapSocket(socket)
if (window.location.hash && window.location.hash.includes('debug_socket')) {
	socket.onAny(function (name, ...data) {
		console.log('received event', name, data)
	})
}

const root = createRoot(document.getElementById('root')!)
root.render(
	<React.StrictMode>
		<SocketContext.Provider value={socketWrapped}>
			<RouterProvider router={router} notFoundMode="fuzzy" />
		</SocketContext.Provider>
	</React.StrictMode>
)
