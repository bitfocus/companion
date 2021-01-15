import React from 'react'
import Select from 'react-select'
import { CInput, CInputCheckbox } from "@coreui/react"

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
		// TODO dropdown-native but it appears to be unused
		default:
			return <p>Unknown field "{definition.type}"</p>
	}
}

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
			this.onChange(this.props.value)
		}
	}

	onChange = (newValue) => {
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

		this.props.setValue(newValue, isValid)
	}

	render() {
		const { definition, value, valid } = this.props

		return <CInput
			type='text'
			value={value}
			style={{ color: !valid ? 'red' : undefined }}
			tooltip={definition.tooltip}
			onChange={(e) => this.onChange(e.currentTarget.value)}
		/>
	}
}

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
		console.log('checked', newValue, !!newValue)
		// TODO - test this
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

export class DropdownInputField extends React.Component {

	componentDidMount() {
		this.onChange(this.props.value ?? this.props.definition.default)
	}
	componentDidUpdate(prevProps) {
		if (prevProps.value !== this.props.value) {
			this.onChange(this.props.value)
		}
	}

	onChange = (newValue) => {
		const { definition } = this.props
		const isMultiple = !!definition.multiple

		let isValid = true

		// TODO multiple etc

		if (isMultiple) {
			for (const val of newValue) {
				// Require the selected choices to be valid
				if (!definition.choices.find(c => c.id === val)) {
					isValid = false
				}
			}

			if (typeof definition.minSelection === 'number' && newValue.length < definition.minSelection && newValue.length <= (this.props.value || []).length) {
				// Block change if too few are selected
				return
			}

			if (typeof definition.maximumSelectionLength === 'number' && newValue.length > definition.maximumSelectionLength && newValue.length >= (this.props.value || []).length) {
				// Block change if too many are selected
				return
			}

		} else {

			// Require the selected choice to be valid
			if (!definition.choices.find(c => c.id === newValue)) {
				isValid = false
			}
		}

		this.props.setValue(newValue, isValid)
	}

	render() {
		const { definition, value, valid } = this.props

		const options = []
		for (const choice of definition.choices) {
			const entry = { value: choice.id, label: choice.label }
			options.push(entry)
		}

		const isMultiple = !!definition.multiple
		const selectedValue = Array.isArray(value) ? value : [value]

		let currentValue = []
		for (const val of selectedValue) {
			// eslint-disable-next-line eqeqeq
			const entry = options.find(o => o.value == val) // Intentionally loose for compatability
			if (entry) {
				currentValue.push(entry)
			} else {
				currentValue.push({ value: val, label: `?? (${val})` })
			}
		}

		// if (option.tags === true) {
		//     selectoptions.tags = true;
		//     if (typeof option.regex !== 'undefined') {
		//         var flags = option.regex.replace(/.*\/([gimy]*)$/, '$1');
		//         var pattern = option.regex.replace(new RegExp('^/(.*?)/'+flags+'$'), '$1');
		//         let regex = new RegExp(pattern, flags);
		//         selectoptions.createTag = function (params) {
		//             if (regex.test(params.term) === false) {
		//                 return null;
		//             }
		//             return {
		//                 id: params.term,
		//                 text: params.term
		//             }
		//         };
		//     }
		// }

		return <Select
			isClearable={false}
			isSearchable={typeof definition.minChoicesForSearch === 'number' && definition.minChoicesForSearch <= options.length}
			isMulti={isMultiple}
			tooltip={definition.tooltip}
			options={options}
			value={isMultiple ? currentValue : currentValue[0]}
			onChange={(e) => isMultiple ? this.onChange(e?.map(v => v.value) ?? []) : this.onChange(e?.value)}
		/>
	}
}
