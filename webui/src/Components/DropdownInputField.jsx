import { useMemo, useEffect, useCallback } from 'react'
import Select from 'react-select'

export function DropdownInputField({ definition, multiple, value, setValue, setValid }) {
	const options = useMemo(() => {
		let choices = []
		if (definition.choices) {
			if (Array.isArray(definition.choices)) {
				choices = definition.choices
			} else if (typeof definition.choices === 'object') {
				choices = Object.values(definition.choices)
			}
		}

		return choices.map((choice) => ({ value: choice.id, label: choice.label }))
	}, [definition.choices])

	const isMultiple = !!multiple

	const currentValue = useMemo(() => {
		const selectedValue = Array.isArray(value) ? value : [value]
		let res = []
		for (const val of selectedValue) {
			// eslint-disable-next-line eqeqeq
			const entry = options.find((o) => o.value == val) // Intentionally loose for compatability
			if (entry) {
				res.push(entry)
			} else {
				res.push({ value: val, label: `?? (${val})` })
			}
		}
		return res
	}, [value, options])

	// If the value is undefined, populate with the default. Also inform the parent about the validity
	useEffect(() => {
		if (value === undefined && definition.default !== undefined) {
			setValue(definition.default)
		}
		setValid?.(true)
	}, [definition.default, value, setValue, setValid])

	const onChange = useCallback(
		(e) => {
			const isMultiple = !!multiple
			const newValue = isMultiple ? e?.map((v) => v.value) ?? [] : e?.value

			let isValid = true

			if (isMultiple) {
				for (const val of newValue) {
					// Require the selected choices to be valid
					if (!options.find((c) => c.value === val)) {
						isValid = false
					}
				}

				if (
					typeof definition.minSelection === 'number' &&
					newValue.length < definition.minSelection &&
					newValue.length <= (this.props.value || []).length
				) {
					// Block change if too few are selected
					return
				}

				if (
					typeof definition.maximumSelectionLength === 'number' &&
					newValue.length > definition.maximumSelectionLength &&
					newValue.length >= (this.props.value || []).length
				) {
					// Block change if too many are selected
					return
				}
			} else {
				// Require the selected choice to be valid
				if (!options.find((c) => c.value === newValue)) {
					isValid = false
				}
			}

			setValue(newValue)
			setValid?.(isValid)
		},
		[setValue, setValid, multiple, definition.minSelection, definition.maximumSelectionLength, options]
	)

	return (
		<div className="select-tooltip" title={definition.tooltip}>
			<Select
				menuPlacement="auto"
				isClearable={false}
				isSearchable={
					typeof definition.minChoicesForSearch === 'number' && definition.minChoicesForSearch <= options.length
				}
				isMulti={isMultiple}
				options={options}
				value={isMultiple ? currentValue : currentValue[0]}
				onChange={onChange}
			/>
		</div>
	)
}
