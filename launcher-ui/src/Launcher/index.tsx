import '~/tailwind.css'
import './Launcher.css'
import React from 'react'
import { createRoot } from 'react-dom/client'
import { Launcher } from './Launcher.js'

const rootElm = document.getElementById('root')!
const root = createRoot(rootElm)
root.render(
	<React.StrictMode>
		<Launcher />
	</React.StrictMode>
)
