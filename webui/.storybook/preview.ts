import type { Decorator, Preview } from '@storybook/react'
import '../src/tailwind.css'
import './preview.css'
import alignmentImg from '../src/scss/img/alignment.png'
import checkImg from '../src/scss/img/check.svg?no-inline'
import indeterminateImg from '../src/scss/img/indeterminate.svg?no-inline'

document.body.style.setProperty('--companion-img-alignment', `url(${alignmentImg})`)
document.body.style.setProperty('--companion-img-check', `url(${checkImg})`)
document.body.style.setProperty('--companion-img-indeterminate', `url(${indeterminateImg})`)

/** Show stories in the light or dark theme, from the toolbar, the same way the app does: `data-theme` on <html> */
const withTheme: Decorator = (Story, context) => {
	const theme = context.globals.theme === 'dark' ? 'dark' : 'light'
	document.documentElement.dataset.theme = theme
	document.documentElement.style.colorScheme = theme
	return Story()
}

const preview: Preview = {
	globalTypes: {
		theme: {
			description: 'App theme',
			toolbar: {
				title: 'Theme',
				icon: 'mirror',
				items: [
					{ value: 'light', title: 'Light', icon: 'sun' },
					{ value: 'dark', title: 'Dark', icon: 'moon' },
				],
				dynamicTitle: true,
			},
		},
	},
	initialGlobals: {
		theme: 'light',
	},
	decorators: [withTheme],
	parameters: {
		controls: {
			matchers: {
				color: /(background|color)$/i,
				date: /Date$/i,
			},
		},
	},
}

export default preview
