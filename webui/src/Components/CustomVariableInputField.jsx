import classNames from 'classnames'
import { useContext } from 'react'
import { useMemo, useEffect, useCallback } from 'react'
import Select from 'react-select'
import { CustomVariableDefinitionsContext } from '../util'

export function CustomVariableInputField({ definition, multiple, value, setValue, setValid }) {
	const customVariableContext = useContext(CustomVariableDefinitionsContext)

	const options = useMemo(() => {
		return Object.entries(customVariableContext).map(([name, info]) => ({
			value: name,
			label: name,
		}))
	}, [customVariableContext])
	const defaultVal = options[0]?.value

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

	const isValueValid = useCallback(
		(newValue) => {
			// Require the selected choice to be valid
			return options.find((c) => c.value === newValue)
		},
		[options]
	)

	// If the value is undefined, populate with the default. Also inform the parent about the validity
	useEffect(() => {
		if (value === undefined && defaultVal !== undefined) {
			setValue(defaultVal)
			setValid?.(isValueValid(defaultVal))
		} else {
			setValid?.(isValueValid(value))
		}
	}, [defaultVal, value, setValue, setValid, isValueValid])

	const onChange = useCallback(
		(e) => {
			const newValue = e?.value

			const isValid = isValueValid(newValue)

			setValue(newValue)
			setValid?.(isValid)
		},
		[setValue, setValid, isValueValid]
	)

	const minChoicesForSearch = 10

	const selectProps = {
		classNamePrefix: 'select-control',
		menuPlacement: 'auto',
		isClearable: false,
		isSearchable: minChoicesForSearch <= options.length,
		isMulti: false,
		options: options,
		value: currentValue[0],
		onChange: onChange,
	}

	return (
		<div
			className={classNames({
				'select-tooltip': true,
				'select-invalid': !isValueValid(currentValue[0]?.value),
			})}
			title={definition.tooltip}
		>
			<Select {...selectProps} />
		</div>
	)
}
