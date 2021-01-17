import React from 'react'
import Select from 'react-select'

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
