import React from 'react'
import { CheckboxInputField } from './CheckboxInputField'
import { DropdownInputField } from './DropdownInputField'
import { TextInputField } from './TextInputField'
import { NumberInputField } from './NumberInputField'

export { ColorInputField } from './ColorInputField'
export { TextWithVariablesInputField } from './TextWithVariablesInputField'
export { PNGInputField } from './PNGInputField'
export { AlignmentInputField } from './AlignmentInputField'
export { CheckboxInputField } from './CheckboxInputField'
export { DropdownInputField } from './DropdownInputField'
export { TextInputField } from './TextInputField'
export { NumberInputField } from './NumberInputField'

export function ConfigField(props) {
	const { definition } = props
	switch (definition.type) {
		case 'text':
			return <p title={definition.tooltip}>{definition.value}</p>
		case 'textinput':
			return <TextInputField {...props} />
		case 'number':
			return <NumberInputField {...props} />
		case 'checkbox':
			return <CheckboxInputField {...props} />
		case 'dropdown':
			return <DropdownInputField {...props} />
		default:
			return <p>Unknown field "{definition.type}"</p>
	}
}
