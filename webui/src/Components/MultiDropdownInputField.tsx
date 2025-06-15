import { DropdownChoice, DropdownChoiceId } from '@companion-module/base'
import { CFormLabel } from '@coreui/react'
import classNames from 'classnames'
import React, { useContext, useMemo, useCallback, memo } from 'react'
import Select, { createFilter } from 'react-select'
import CreatableSelect, { CreatableProps } from 'react-select/creatable'
import { InlineHelp } from './InlineHelp.js'
import { WindowedMenuList } from 'react-windowed-select'
import { MenuPortalContext } from './MenuPortalContext.js'

interface MultiDropdownInputFieldProps {
	htmlName?: string
	className?: string
	label?: React.ReactNode
	choices: DropdownChoice[] | Record<string, DropdownChoice>
	allowCustom?: boolean
	minSelection?: number
	minChoicesForSearch?: number
	maxSelection?: number
	tooltip?: string
	regex?: string
	value: DropdownChoiceId[]
	setValue: (value: DropdownChoiceId[]) => void
	checkValid?: (value: DropdownChoiceId[]) => boolean
	disabled?: boolean
	helpText?: string
	onBlur?: () => void
}

interface DropdownChoiceInt {
	value: any
	label: DropdownChoiceId
}

export const MultiDropdownInputField = memo(function MultiDropdownInputField({
	htmlName,
	className,
	label,
	choices,
	allowCustom,
	minSelection,
	minChoicesForSearch,
	maxSelection,
	tooltip,
	regex,
	value,
	setValue,
	checkValid,
	disabled,
	helpText,
	onBlur,
}: MultiDropdownInputFieldProps) {
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

	if (value === undefined) value = [] as any

	const currentValue = useMemo(() => {
		const selectedValue = Array.isArray(value) ? value : [value]
		const res: DropdownChoiceInt[] = []
		for (const val of selectedValue) {
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

	const onChange = useCallback(
		(e: DropdownChoiceInt[]) => {
			const newValue = e?.map((v) => v.value) ?? []

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

			setValue(newValue)
		},
		[setValue, value, minSelection, maxSelection]
	)

	const minChoicesForSearch2 = typeof minChoicesForSearch === 'number' ? minChoicesForSearch : 10

	// const selectRef = useRef<any>(null)

	const selectProps: Partial<CreatableProps<any, any, any>> = {
		name: htmlName,
		isDisabled: disabled,
		classNamePrefix: 'select-control',
		className: 'select-control',
		menuPortalTarget: menuPortal || document.body,
		menuShouldBlockScroll: !!menuPortal, // The dropdown doesn't follow scroll when in a modal
		menuPosition: 'fixed',
		menuPlacement: 'auto',
		isClearable: false,
		isSearchable: minChoicesForSearch2 <= options.length,
		isMulti: true,
		options: options,
		value: currentValue,
		onChange: onChange,
		filterOption: createFilter({ ignoreAccents: false }),
		components: { MenuList: WindowedMenuList },
		onBlur: onBlur,
	}

	const isValidNewOption = useCallback(
		(newValue: string | number) => typeof newValue === 'string' && (!compiledRegex || !!newValue.match(compiledRegex)),
		[compiledRegex]
	)
	const noOptionsMessage = useCallback(
		({ inputValue }: { inputValue: string | number }) => {
			if (!isValidNewOption(inputValue)) {
				return 'Input is not a valid value'
			} else {
				return 'Begin typing to use a custom value'
			}
		},
		[isValidNewOption]
	)
	const formatCreateLabel = useCallback((v: string | number) => `Use "${v}"`, [])

	return (
		<div
			className={classNames(
				{
					'select-tooltip': true,
					'select-invalid': !!checkValid && !checkValid(currentValue.map((v) => v.value) ?? []),
				},
				className
			)}
			title={tooltip}
		>
			{helpText ? (
				<InlineHelp help={helpText}>
					<>{label ? <CFormLabel>{label}</CFormLabel> : null}</>
				</InlineHelp>
			) : (
				<>{label ? <CFormLabel>{label}</CFormLabel> : null}</>
			)}
			{allowCustom ? (
				<CreatableSelect
					{...selectProps}
					// ref={selectRef}
					className={`${selectProps.className} select-control-editable`}
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
}) as (props: MultiDropdownInputFieldProps) => JSX.Element
