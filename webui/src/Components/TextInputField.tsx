import React, { useEffect, useMemo, useState, useCallback, useContext, ChangeEvent, useRef } from 'react'
import { CInput } from '@coreui/react'
import { VariableDefinitionsContext } from '../util.js'
import Select, { OptionProps, components as SelectComponents, createFilter } from 'react-select'
import { MenuPortalContext } from './DropdownInputField.js'
import { DropdownChoiceId } from '@companion-module/base'
import { observer } from 'mobx-react-lite'

interface TextInputFieldProps {
	regex?: string
	required?: boolean
	tooltip?: string
	placeholder?: string
	value: string
	style?: React.CSSProperties
	setValue: (value: string) => void
	setValid?: (valid: boolean) => void
	disabled?: boolean
	useVariables?: boolean
	useLocationVariables?: boolean
}

export const TextInputField = observer(function TextInputField({
	regex,
	required,
	tooltip,
	placeholder,
	value,
	style,
	setValue,
	setValid,
	disabled,
	useVariables,
	useLocationVariables,
}: TextInputFieldProps) {
	const [tmpValue, setTmpValue] = useState<string | null>(null)

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

	// Check if the value is valid
	const isValueValid = useCallback(
		(val: string) => {
			// We need a string here, but sometimes get a number...
			if (typeof val === 'number') {
				val = `${val}`
			}

			// Must match the regex, if required or has a value
			if (required || val !== '') {
				if (compiledRegex && (typeof val !== 'string' || !val.match(compiledRegex))) {
					return false
				}
			}

			// if required, must not be empty
			if (required && val === '') {
				return false
			}

			return true
		},
		[compiledRegex, required]
	)

	// If the value is undefined, populate with the default. Also inform the parent about the validity
	useEffect(() => {
		setValid?.(isValueValid(value))
	}, [isValueValid, value, setValid])

	const storeValue = useCallback(
		(value: string) => {
			// const newValue = decode(e.currentTarget.value, { scope: 'strict' })
			setTmpValue(value)
			setValue(value)
			setValid?.(isValueValid(value))
		},
		[setValue, setValid, isValueValid]
	)
	const doOnChange = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>) => storeValue(e.currentTarget.value),
		[storeValue]
	)

	let isPickerOpen = false
	let searchValue = ''

	const innerRef = useRef<HTMLInputElement>(null)
	if (innerRef.current) {
		console.log('cursor', innerRef.current.selectionStart)
		if (innerRef.current.selectionStart != null && innerRef.current.selectionStart === innerRef.current.selectionEnd) {
			const lastOpen = FindVariableStartIndexFromCursor(value, innerRef.current.selectionStart)
			isPickerOpen = lastOpen !== -1
			console.log('open', FindVariableStartIndexFromCursor(value, innerRef.current.selectionStart))

			searchValue = value.slice(lastOpen + 2, innerRef.current.selectionStart)
			console.log('search', searchValue)
		}
	}

	const valueRef = useRef<string>()
	valueRef.current = value

	const onVariableSelect = useCallback((variable: DropdownChoiceInt | null) => {
		const oldValue = valueRef.current
		if (!variable || !oldValue || !innerRef.current) return

		if (!innerRef.current.selectionStart) return // Nothing selected

		const openIndex = FindVariableStartIndexFromCursor(oldValue, innerRef.current.selectionStart)
		if (openIndex === -1) return

		storeValue(oldValue.slice(0, openIndex) + `$(${variable.value})` + oldValue.slice(innerRef.current.selectionStart))
	}, [])

	// const [variableSearchOpen, setVariableSearchOpen] = useState(false)

	const onFocusChange = useCallback(() => {
		console.log('focus change')
	}, [])

	// Render the input
	const extraStyle = style || {}
	return (
		<>
			<CInput
				innerRef={innerRef}
				type="text"
				disabled={disabled}
				value={tmpValue ?? value ?? ''}
				style={{ color: !isValueValid(tmpValue ?? value) ? 'red' : undefined, ...extraStyle }}
				title={tooltip}
				onChange={doOnChange}
				onFocus={() => setTmpValue(value ?? '')}
				onBlur={() => setTmpValue(null)}
				placeholder={placeholder}
				onFocusCapture={onFocusChange}
				onBlurCapture={onFocusChange}
			/>
			<p style={{ width: '1000px' }}>aa</p>
			{useVariables && (
				<VariablesSelect
					isOpen={isPickerOpen}
					searchValue={searchValue}
					onVariableSelect={onVariableSelect}
					useLocationVariables={!!useLocationVariables}
				/>
			)}
		</>
	)
})

interface DropdownChoiceInt {
	value: string
	label: DropdownChoiceId
}

interface VariablesSelectProps {
	isOpen: boolean
	searchValue: string
	onVariableSelect: (newValue: DropdownChoiceInt | null) => void
	useLocationVariables: boolean
}

function VariablesSelect({ isOpen, searchValue, onVariableSelect, useLocationVariables }: VariablesSelectProps) {
	const variableDefinitionsContext = useContext(VariableDefinitionsContext)
	const menuPortal = useContext(MenuPortalContext)

	const options = useMemo(() => {
		// Update the suggestions list in tribute whenever anything changes
		const suggestions: DropdownChoiceInt[] = []
		for (const [connectionLabel, variables] of Object.entries(variableDefinitionsContext)) {
			for (const [name, va] of Object.entries(variables || {})) {
				if (!va) continue
				const variableId = `${connectionLabel}:${name}`
				suggestions.push({
					// key: variableId + ')',
					value: variableId,
					label: va.label,
				})
			}
		}

		if (useLocationVariables) {
			suggestions.push(
				{
					// key: 'this:page)',
					value: 'this:page',
					label: 'This page',
				},
				{
					// key: 'this:column)',
					value: 'this:column',
					label: 'This column',
				},
				{
					// key: 'this:row)',
					value: 'this:row',
					label: 'This row',
				},
				{
					// key: 'this:page_name)',
					value: 'this:page_name',
					label: 'This page name',
				}
			)
		}

		return suggestions
	}, [variableDefinitionsContext, useLocationVariables])

	const valueOption: DropdownChoiceInt = {
		value: searchValue,
		label: searchValue,
	}
	console.log('s', searchValue)

	return (
		<Select
			// classNamePrefix: 'select-control',
			menuPortalTarget={menuPortal || document.body}
			menuShouldBlockScroll={!!menuPortal} // The dropdown doesn't follow scroll when in a modal
			menuPosition="fixed"
			menuPlacement="auto"
			isSearchable
			isMulti={false}
			options={options}
			// value={valueOption}
			value={null}
			inputValue={searchValue}
			onChange={onVariableSelect}
			menuIsOpen={isOpen}
			components={{ Option: CustomOption }}
			filterOption={filterOption}
			controlShouldRenderValue={false}
		/>
	)
}

const baseFilter = createFilter<DropdownChoiceInt>()
const filterOption: ReturnType<typeof createFilter<DropdownChoiceInt>> = (option, inputValue) => {
	console.log('filter', inputValue)
	return baseFilter(option, inputValue)
}

const CustomOption = (props: OptionProps<DropdownChoiceInt>) => {
	const { data } = props
	return (
		<SelectComponents.Option {...props} className={(props.className ?? '') + 'variable-suggestion-option'}>
			<span className="var-name">{data.value}</span>
			<span className="var-label">{data.label}</span>
		</SelectComponents.Option>
	)
}

function FindVariableStartIndexFromCursor(text: string, cursor: number): number {
	const previousOpen = cursor >= 2 ? text.lastIndexOf('$(', cursor - 2) : -1
	const previousClose = cursor >= 1 ? text.lastIndexOf(')', cursor - 1) : -1

	// Already closed
	if (previousOpen < previousClose) return -1
	// Not open
	if (previousOpen === -1) return -1

	// TODO - ensure contents is valid

	console.log('open', previousOpen, 'close', previousClose)
	return previousOpen
}
