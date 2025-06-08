import { DropdownChoice, DropdownChoiceId } from '@companion-module/base'
import { CFormLabel } from '@coreui/react'
import classNames from 'classnames'
import React, { useContext, useMemo, useEffect, useCallback, memo, useState } from 'react'
import Select, { createFilter, InputActionMeta, components } from 'react-select'
import CreatableSelect, { CreatableProps } from 'react-select/creatable'
import { InlineHelp } from './InlineHelp.js'
import { WindowedMenuList } from 'react-windowed-select'
import { MenuPortalContext } from './MenuPortalContext.js'

interface DropdownInputFieldProps {
	htmlName?: string
	className?: string
	label?: React.ReactNode
	choices: DropdownChoice[] | Record<string, DropdownChoice>
	allowCustom?: boolean
	disableEditingCustom?: boolean
	minChoicesForSearch?: number
	tooltip?: string
	regex?: string
	value: DropdownChoiceId
	setValue: (value: DropdownChoiceId) => void
	setValid?: (valid: boolean) => void
	disabled?: boolean
	helpText?: string
	onBlur?: () => void
	onPasteIntercept?: (value: string) => string
}

interface DropdownChoiceInt {
	value: any
	label: DropdownChoiceId
}

export const DropdownInputField = memo(function DropdownInputField({
	htmlName,
	className,
	label,
	choices,
	allowCustom,
	disableEditingCustom,
	minChoicesForSearch,
	tooltip,
	regex,
	value,
	setValue,
	setValid,
	disabled,
	helpText,
	onBlur,
	onPasteIntercept,
}: DropdownInputFieldProps): React.JSX.Element {
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

	const isValueValid = useCallback(
		(newValue: DropdownChoiceId | DropdownChoiceId[]) => {
			// Require the selected choice to be valid
			if (
				allowCustom &&
				compiledRegex &&
				!options.find((c) => c.value === newValue) &&
				!compiledRegex.exec(String(newValue))
			) {
				return false
			}

			return true
		},
		[allowCustom, compiledRegex, options]
	)

	// If the value is undefined, populate with the default. Also inform the parent about the validity
	useEffect(() => {
		setValid?.(isValueValid(value))
	}, [value, setValid, isValueValid])

	const onChange = useCallback(
		(e: DropdownChoiceInt) => {
			const newValue = e?.value

			const isValid = isValueValid(newValue)

			setValue(newValue)
			setValid?.(isValid)
		},
		[setValue, setValid, isValueValid]
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

		return (props: any) => <components.Input {...props} onPaste={onPaste} />
	}, [onPasteIntercept])

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
		isMulti: false,
		options: options,
		value: currentValue,
		onChange: onChange,
		filterOption: createFilter({ ignoreAccents: false }),
		components: {
			MenuList: WindowedMenuList,
			Input: inputComponent,
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
					'select-invalid': !isValueValid(currentValue?.value),
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
