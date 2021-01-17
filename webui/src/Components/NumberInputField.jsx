import React from 'react'
import { CInput } from '@coreui/react'

export class NumberInputField extends React.Component {

	componentDidMount() {
		this.onChange(this.props.value ?? this.props.definition.default)
	}
	componentDidUpdate(prevProps) {
		if (prevProps.value !== this.props.value) {
			this.onChange(this.props.value)
		}
	}

	onChange = (rawValue) => {
		const { definition } = this.props

		let isValid = true
		const parsedValue = parseFloat(rawValue)
		const processedValue = isNaN(parsedValue) ? rawValue : parsedValue

		if (rawValue === '') {
			// If required, it must not be empty
			if (definition.required) {
				isValid = false
			}
		} else {
			// If has a value, it must be a number
			if (isNaN(parsedValue)) {
				isValid = false
			}

			// Verify the value range
			if (definition.min !== undefined && parsedValue < definition.min) {
				isValid = false
			}
			if (definition.max !== undefined && parsedValue > definition.max) {
				isValid = false
			}
		}

		this.props.setValue(processedValue, isValid)
	}

	render() {
		const { definition, value, valid } = this.props

		return <CInput
			type='number'
			value={value ?? definition.default}
			min={definition.min}
			max={definition.max}
			style={{ color: !valid ? 'red' : undefined }}
			tooltip={definition.tooltip}
			onChange={(e) => this.onChange(e.currentTarget.value)}
		/>
	}
}
