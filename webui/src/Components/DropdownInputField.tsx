import { DropdownChoice, DropdownChoiceId } from '@companion-module/base'
import classNames from 'classnames'
import React, { createContext, useContext, useMemo, useEffect, useCallback, memo } from 'react'
import Select from 'react-select'
import CreatableSelect, { CreatableProps } from 'react-select/creatable'

export const MenuPortalContext = createContext<HTMLElement | null>(null)

type AsType<Multi extends boolean> = Multi extends true ? DropdownChoiceId[] : DropdownChoiceId

interface DropdownInputFieldProps<Multi extends boolean> {
	choices: DropdownChoice[] | Record<string, DropdownChoice>
	allowCustom?: boolean
	minSelection?: number
	minChoicesForSearch?: number
	maxSelection?: number
	tooltip?: string
	regex?: string
	multiple: Multi
	value: AsType<Multi>
	setValue: (value: AsType<Multi>) => void
	setValid?: (valid: boolean) => void
	disabled?: boolean
}

interface DropdownChoiceInt {
	value: any
	label: DropdownChoiceId
}

export const DropdownInputField = memo(function DropdownInputField<Multi extends boolean>({
	choices,
	allowCustom,
	minSelection,
	minChoicesForSearch,
	maxSelection,
	tooltip,
	regex,
	multiple,
	value,
	setValue,
	setValid,
	disabled,
}: DropdownInputFieldProps<Multi>) {
	const menuPortal = useContext(MenuPortalContext)

	const options = useMemo(() => {
		let options: DropdownChoice[] = []
		if (options) {
			if (Array.isArray(choices)) {
				options = choices
			} else if (typeof choices === 'object') {
				options = Object.values(choices)
			}
		}

		return options.map((choice): DropdownChoiceInt => ({ value: choice.id, label: choice.label }))
	}, [choices])

	const isMultiple = !!multiple

	if (isMultiple && value === undefined) value = [] as any

	const currentValue = useMemo(() => {
		const selectedValue = Array.isArray(value) ? value : [value]
		let res: DropdownChoiceInt[] = []
		for (const val of selectedValue) {
			// eslint-disable-next-line eqeqeq
			const entry = options.find((o) => o.value == val) // Intentionally loose for compatibility
			if (entry) {
				res.push(entry)
			} else {
				res.push({ value: val, label: allowCustom ? val : `?? (${val})` })
			}
		}
		return res
	}, [value, options, allowCustom])

	// Compile the regex (and cache)
	const compiledRegex = useMemo(() => {
		if (regex) {
			// Compile the regex string
			const match = regex.match(/^\/(.*)\/(.*)$/)
			if (match) {
				return new RegExp(match[1], match[2])
			}
		}
		return null
	}, [regex])

	const isValueValid = useCallback(
		(newValue) => {
			if (isMultiple) {
				for (const val of newValue) {
					// Require the selected choices to be valid
					if (
						allowCustom &&
						compiledRegex &&
						!options.find((c) => c.value === val) &&
						(typeof val !== 'string' || !val.match(compiledRegex))
					) {
						return false
					}
				}
			} else {
				// Require the selected choice to be valid
				if (
					allowCustom &&
					compiledRegex &&
					!options.find((c) => c.value === newValue) &&
					(typeof newValue !== 'string' || !newValue.match(compiledRegex))
				) {
					return false
				}
			}

			return true
		},
		[allowCustom, compiledRegex, options, isMultiple]
	)

	// If the value is undefined, populate with the default. Also inform the parent about the validity
	useEffect(() => {
		setValid?.(isValueValid(value))
	}, [value, setValid, isValueValid])

	const onChange = useCallback(
		(e: DropdownChoiceInt | DropdownChoiceInt[]) => {
			const isMultiple = !!multiple
			const newValue = Array.isArray(e) ? e?.map((v) => v.value) ?? [] : e?.value

			const isValid = isValueValid(newValue)

			if (isMultiple) {
				const valueArr = value as DropdownChoiceId[] | undefined
				if (
					typeof minSelection === 'number' &&
					newValue.length < minSelection &&
					newValue.length <= (valueArr || []).length
				) {
					// Block change if too few are selected
					return
				}

				if (
					typeof maxSelection === 'number' &&
					newValue.length > maxSelection &&
					newValue.length >= (valueArr || []).length
				) {
					// Block change if too many are selected
					return
				}
			}

			setValue(newValue)
			setValid?.(isValid)
		},
		[setValue, setValid, value, multiple, minSelection, maxSelection, isValueValid]
	)

	const minChoicesForSearch2 = typeof minChoicesForSearch === 'number' ? minChoicesForSearch : 10

	const selectProps: Partial<CreatableProps<any, any, any>> = {
		isDisabled: disabled,
		classNamePrefix: 'select-control',
		menuPortalTarget: menuPortal || document.body,
		menuShouldBlockScroll: !!menuPortal, // The dropdown doesn't follow scroll when in a modal
		menuPosition: 'fixed',
		menuPlacement: 'auto',
		isClearable: false,
		isSearchable: minChoicesForSearch2 <= options.length,
		isMulti: isMultiple,
		options: options,
		value: isMultiple ? currentValue : currentValue[0],
		onChange: onChange,
	}

	const isValidNewOption = useCallback(
		(newValue) => typeof newValue === 'string' && (!compiledRegex || !!newValue.match(compiledRegex)),
		[compiledRegex]
	)
	const noOptionsMessage = useCallback(
		(inputValue) => {
			if (!isValidNewOption(inputValue)) {
				return 'Input is not a valid value'
			} else {
				return 'Begin typing to use a custom value'
			}
		},
		[isValidNewOption]
	)
	const formatCreateLabel = useCallback((v) => `Use "${v}"`, [])

	return (
		<div
			className={classNames({
				'select-tooltip': true,
				'select-invalid': !isValueValid(
					isMultiple && currentValue ? currentValue.map((v) => v.value) ?? [] : currentValue[0]?.value
				),
			})}
			title={tooltip}
		>
			{allowCustom ? (
				<CreatableSelect
					{...selectProps}
					isSearchable={true}
					noOptionsMessage={noOptionsMessage}
					createOptionPosition="first"
					formatCreateLabel={formatCreateLabel}
					isValidNewOption={isValidNewOption}
				/>
			) : (
				<Select {...selectProps} />
			)}
		</div>
	)
}) as <Multi extends boolean>(props: DropdownInputFieldProps<Multi>) => JSX.Element
