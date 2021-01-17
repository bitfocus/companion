import React from 'react'
import { CInput } from '@coreui/react'

export class TextInputField extends React.Component {

	compileRegex() {
		const { definition } = this.props

		if (definition.regex) {
			// Compile the regex string
			const match = definition.regex.match(/^\/(.*)\/(.*)$/)
			if (match) {
				return new RegExp(match[1], match[2])
			}
		}

		return null
	}

	componentDidMount() {
		this.onChange(this.props.value ?? this.props.definition.default)
	}
	componentDidUpdate(prevProps) {
		if (prevProps.value !== this.props.value) {
			this.onChange(this.props.value, true)
		}
	}

	onChange = (newValue, validateOnly) => {
		if (validateOnly && !this.props.setValid) {
			return
		}

		const { definition } = this.props

		let isValid = true

		// Must match the regex
		const regex = this.compileRegex()
		if (regex && (newValue === undefined || !newValue.match(regex))) {
			isValid = false
		}

		// if required, must not be empty
		if (definition.required && newValue === '') {
			isValid = false
		}

		if (validateOnly) {
			this.props.setValid(isValid)
		} else {
			this.props.setValue(newValue, isValid)
		}
	}

	render() {
		const { definition, value, valid } = this.props

		return <CInput
			type='text'
			value={value}
			style={{ color: !valid ? 'red' : undefined }}
			tooltip={definition.tooltip}
			onChange={(e) => this.onChange(e.currentTarget.value, false)}
		/>
	}
}
