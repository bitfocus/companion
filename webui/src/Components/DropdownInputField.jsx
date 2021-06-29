import classNames from 'classnames'
import { useMemo, useEffect, useCallback } from 'react'
import Select from 'react-select'
import CreatableSelect from 'react-select/creatable'

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
				res.push({ value: val, label: definition.allowCustom ? val : `?? (${val})` })
			}
		}
		return res
	}, [value, options, definition.allowCustom])

	// Compile the regex (and cache)
	const regex = useMemo(() => {
		if (definition.regex) {
			// Compile the regex string
			const match = definition.regex.match(/^\/(.*)\/(.*)$/)
			if (match) {
				return new RegExp(match[1], match[2])
			}
		}
		return null
	}, [definition.regex])

	const isValueValid = useCallback(
		(newValue) => {
			if (isMultiple) {
				for (const val of newValue) {
					// Require the selected choices to be valid
					if (
						!options.find((c) => c.value === val) &&
						definition.allowCustom &&
						regex &&
						(typeof val !== 'string' || !val.match(regex))
					) {
						return false
					}
				}
			} else {
				// Require the selected choice to be valid
				if (
					!options.find((c) => c.value === newValue) &&
					definition.allowCustom &&
					regex &&
					(typeof newValue !== 'string' || !newValue.match(regex))
				) {
					return false
				}
			}

			return true
		},
		[definition.allowCustom, regex, options, isMultiple]
	)

	// If the value is undefined, populate with the default. Also inform the parent about the validity
	useEffect(() => {
		if (value === undefined && definition.default !== undefined) {
			setValue(definition.default)
			setValid?.(isValueValid(definition.default))
		} else {
			setValid?.(isValueValid(value))
		}
	}, [definition.default, value, setValue, setValid, isValueValid])

	const onChange = useCallback(
		(e) => {
			const isMultiple = !!multiple
			const newValue = isMultiple ? e?.map((v) => v.value) ?? [] : e?.value

			const isValid = isValueValid(newValue)

			if (isMultiple) {
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
			}

			setValue(newValue)
			setValid?.(isValid)
		},
		[setValue, setValid, multiple, definition.minSelection, definition.maximumSelectionLength, isValueValid]
	)

	const minChoicesForSearch = typeof definition.minChoicesForSearch === 'number' ? definition.minChoicesForSearch : 10

	const selectProps = {
		classNamePrefix: 'select-control',
		menuPlacement: 'auto',
		isClearable: false,
		isSearchable: minChoicesForSearch <= options.length,
		isMulti: isMultiple,
		options: options,
		value: isMultiple ? currentValue : currentValue[0],
		onChange: onChange,
	}

	return (
		<div
			className={classNames({
				'select-tooltip': true,
				'select-invalid': !isValueValid(
					isMultiple && currentValue ? currentValue.map((v) => v.value) ?? [] : currentValue[0]?.value
				),
			})}
			title={definition.tooltip}
		>
			{definition.allowCustom ? (
				<CreatableSelect
					{...selectProps}
					isSearchable={true}
					noOptionsMessage={() => 'Begin typing to use a custom value'}
					createOptionPosition="first"
					formatCreateLabel={(v) => `Use "${v}"`}
				/>
			) : (
				<Select {...selectProps} />
			)}
		</div>
	)
}
