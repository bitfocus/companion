import React from 'react'
import { CInputCheckbox } from '@coreui/react'

export class CheckboxInputField extends React.Component {

	componentDidMount() {
		this.onChange(this.props.value ?? this.props.definition.default)
	}
	componentDidUpdate(prevProps) {
		if (prevProps.value !== this.props.value) {
			this.onChange(this.props.value)
		}
	}

	onChange = (newValue) => {
		this.props.setValue(!!newValue, true)
	}

	render() {
		const { definition, value } = this.props

		return <CInputCheckbox
			type='checkbox'
			checked={!!value}
			value={true}
			tooltip={definition.tooltip}
			onChange={(e) => this.onChange(e.currentTarget.checked)}
		/>
	}
}
