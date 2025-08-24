// import './Resources/Sentry.js'

import '@fontsource/roboto'
import './Settings.css'

if (process.env.NODE_ENV === 'development') {
	const defineProperties = Object.defineProperties
	Object.defineProperties = function (o, props) {
		return o === console ? o : defineProperties(o, props)
	}
}

import React from 'react'
import { createRoot } from 'react-dom/client'
import { Settings } from './Settings.js'

const rootElm = document.getElementById('root')!
const root = createRoot(rootElm)
root.render(
	<React.StrictMode>
		<Settings />
	</React.StrictMode>
)
