import type { DropdownChoice, DropdownChoiceId } from '@companion-app/shared/Model/Common.js'
import classNames from 'classnames'
import React, { useContext, useMemo, useCallback, useState } from 'react'
import Select, { createFilter, components, type InputActionMeta } from 'react-select'
import CreatableSelect, { type CreatableProps } from 'react-select/creatable'
// import { WindowedMenuList } from 'react-windowed-select'
import { MenuPortalContext } from './MenuPortalContext.js'
import { useComputed } from '~/Resources/util.js'
import { observer } from 'mobx-react-lite'
import { CustomOption, CustomSingleValue } from '~/DropDownInputFancy.js'

interface DropdownInputFieldProps {
	htmlName?: string
	className?: string
	choices: DropdownChoice[] | Record<string, DropdownChoice>
	allowCustom?: boolean
	disableEditingCustom?: boolean
	minChoicesForSearch?: number
	tooltip?: string
	regex?: string
	value: DropdownChoiceId
	setValue: (value: DropdownChoiceId) => void
	disabled?: boolean
	onBlur?: () => void
	onPasteIntercept?: (value: string) => string
	checkValid?: (value: DropdownChoiceId) => boolean
	fancyFormat?: boolean
	searchLabelsOnly?: boolean
}

interface DropdownChoiceInt {
	value: any
	label: DropdownChoiceId
}

export const DropdownInputField = observer(function DropdownInputField({
	htmlName,
	className,
	choices,
	allowCustom,
	disableEditingCustom,
	minChoicesForSearch,
	tooltip,
	regex,
	value,
	setValue,
	disabled,
	onBlur,
	onPasteIntercept,
	checkValid,
	fancyFormat = false,
	searchLabelsOnly = true,
}: DropdownInputFieldProps): React.JSX.Element {
	const menuPortal = useContext(MenuPortalContext)

	// If fancy format is enabled, always search full option
	if (fancyFormat) searchLabelsOnly = false

	const options = useComputed(() => {
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

	const currentValue = useMemo(() => {
		const entry = options.find((o) => o.value == value) // Intentionally loose for compatibility
		if (entry) {
			return entry
		} else {
			return { value: value, label: allowCustom ? value : `?? (${value})` }
		}
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
		(e: DropdownChoiceInt) => {
			const newValue = e?.value

			setValue(newValue)
		},
		[setValue]
	)

	const inputComponent = useMemo(() => {
		const onPaste = (e: React.ClipboardEvent) => {
			if (!e.clipboardData || !onPasteIntercept) return

			const rawValue = e.clipboardData.getData('text')
			const newValue = onPasteIntercept(rawValue)

			// Nothing changed, let default behaviour happen
			if (newValue === rawValue) return

			e.preventDefault()
			// console.log('Intercept paste', rawValue, 'to', newValue)

			// Set the value of the input, using the native setter
			const target = e.currentTarget as HTMLInputElement
			// eslint-disable-next-line @typescript-eslint/unbound-method
			const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!
			nativeInputValueSetter.call(target, newValue)

			// Dispatch a change event
			target.dispatchEvent(new Event('input', { bubbles: true }))
		}

		return (props: any) => (
			<components.Input
				{...props}
				onPaste={onPaste}
				className={fancyFormat && (props.className ?? '') + 'variable-dropdown-edit'}
			/>
		)
	}, [onPasteIntercept, fancyFormat])

	const minChoicesForSearchNumber = typeof minChoicesForSearch === 'number' ? minChoicesForSearch : 10

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
		isSearchable: minChoicesForSearchNumber <= options.length,
		isMulti: false,
		options: options,
		value: currentValue,
		onChange: onChange,
		filterOption: createFilter({
			ignoreAccents: false,
			stringify: searchLabelsOnly ? (option) => option.label : (option) => `${option.label} ${option.value}`,
		}),
		components: {
			// MenuList: WindowedMenuList,
			Input: inputComponent,
			// couldn't find a cleaner way to do this: otherwise TypeScript complains about Singlevalue...
			...((fancyFormat ? { Option: CustomOption, SingleValue: CustomSingleValue } : {}) as Partial<
				CreatableProps<any, any, any>
			>),
		},
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
	const isValidNewOptionIgnoreCurrent = useCallback(
		(newValue: string | number) => !options.find((opt) => opt.value == newValue) && isValidNewOption(newValue),
		[isValidNewOption, options]
	)
	const formatCreateLabel = useCallback((v: string | number) => `Use "${v}"`, [])

	/**
	 * Do some mangling with the input value to make custom values flow a bit better
	 */
	const [customInputValue, setCustomInputValue] = useState<string | undefined>(undefined)
	const onFocus = () => setCustomInputValue(value + '')
	const onBlurEditingCustom = useCallback(() => {
		setCustomInputValue(undefined)

		onBlur?.()
	}, [onBlur])

	const onChangeEditingCustom = useCallback(
		(e: DropdownChoiceInt) => {
			setCustomInputValue(e.value)
			onChange(e)
		},
		[onChange]
	)
	const onInputChange = useCallback(
		(v: string, a: InputActionMeta) => {
			if (!allowCustom) return

			if (a.action === 'input-blur') {
				onChange({ value: a.prevInputValue, label: a.prevInputValue })
			} else if (a.action === 'input-change') {
				setCustomInputValue(v)
			}
		},
		[onChange, allowCustom]
	)

	const onCreateOption = useCallback(
		(inputValue: string) => {
			setCustomInputValue(inputValue)
			onChange({ value: inputValue, label: inputValue })
		},
		[onChange]
	)

	if (allowCustom && customInputValue === value) {
		// If the custom input value has not changed, then don't use it as a filter
		selectProps.filterOption = null
	}

	return (
		<div
			className={classNames(
				{
					'select-tooltip': true,
					'select-invalid': !!checkValid && !checkValid(currentValue?.value),
				},
				className
			)}
			title={tooltip}
		>
			{allowCustom ? (
				<CreatableSelect
					{...selectProps}
					className={!disableEditingCustom ? `${selectProps.className} select-control-editable` : selectProps.className}
					isSearchable={true}
					noOptionsMessage={noOptionsMessage}
					createOptionPosition="first"
					formatCreateLabel={formatCreateLabel}
					isValidNewOption={isValidNewOptionIgnoreCurrent}
					onFocus={!disableEditingCustom ? onFocus : undefined}
					onBlur={!disableEditingCustom ? onBlurEditingCustom : onBlur}
					onCreateOption={onCreateOption}
					inputValue={allowCustom && !disableEditingCustom ? customInputValue : undefined}
					value={
						!allowCustom ||
						disableEditingCustom ||
						customInputValue === undefined ||
						customInputValue === currentValue?.value
							? currentValue
							: ''
					}
					onInputChange={!disableEditingCustom ? onInputChange : undefined}
					onChange={!disableEditingCustom ? onChangeEditingCustom : onChange}
				/>
			) : (
				<Select {...selectProps} />
			)}
		</div>
	)
}) as (props: DropdownInputFieldProps) => JSX.Element
