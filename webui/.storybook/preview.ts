import type { Preview } from '@storybook/react'
import '../src/App.scss'
import './preview.css'
import alignmentImg from '../src/scss/img/alignment.png'
import checkImg from '../src/scss/img/check.svg?no-inline'
import indeterminateImg from '../src/scss/img/indeterminate.svg?no-inline'

document.body.style.setProperty('--companion-img-alignment', `url(${alignmentImg})`)
document.body.style.setProperty('--companion-img-check', `url(${checkImg})`)
document.body.style.setProperty('--companion-img-indeterminate', `url(${indeterminateImg})`)

const preview: Preview = {
	parameters: {
		backgrounds: {
			default: 'light',
			values: [{ name: 'light', value: '#fff' }],
		},
		controls: {
			matchers: {
				color: /(background|color)$/i,
				date: /Date$/i,
			},
		},
	},
}

export default preview
