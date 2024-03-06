import React, { useEffect, useMemo, useState, useCallback, useContext, useRef } from 'react'
import { CInput } from '@coreui/react'
import { VariableDefinitionsContext } from '../util.js'
import Select, { ControlProps, OptionProps, components as SelectComponents, ValueContainerProps } from 'react-select'
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
			setTmpValue(value)
			setValue(value)
			setValid?.(isValueValid(value))
		},
		[setValue, setValid, isValueValid]
	)
	const doOnChange = useCallback(
		(e: React.ChangeEvent<HTMLInputElement> | React.FormEvent<HTMLInputElement>) => storeValue(e.currentTarget.value),
		[storeValue]
	)

	const showValue = tmpValue ?? value ?? ''

	const [cursorPosition, setCursorPosition] = useState<number | null>(null)
	const { isPickerOpen, searchValue, setIsForceHidden } = useIsPickerOpen(showValue, cursorPosition)

	const valueRef = useRef<string>()
	valueRef.current = showValue

	const onVariableSelect = useCallback(
		(variable: DropdownChoiceInt | null) => {
			const oldValue = valueRef.current
			if (!variable || !oldValue) return

			if (!cursorPosition) return // Nothing selected

			const openIndex = FindVariableStartIndexFromCursor(oldValue, cursorPosition)
			if (openIndex === -1) return

			storeValue(oldValue.slice(0, openIndex) + `$(${variable.value})` + oldValue.slice(cursorPosition))
		},
		[cursorPosition] // TODO - this is very inefficient
	)

	const extraStyle = useMemo(
		() => ({ color: !isValueValid(showValue) ? 'red' : undefined, ...style }),
		[isValueValid, showValue, style]
	)

	const tmpVal = {
		value: showValue,
		setValue: doOnChange,
		setTmpValue: setTmpValue,
		setCursorPosition: setCursorPosition,
		extraStyle: extraStyle,
		forceHideSuggestions: setIsForceHidden,
	}

	// Render the input
	return (
		<>
			<VariablesSelectContext.Provider value={tmpVal}>
				{useVariables ? (
					<VariablesSelect
						isOpen={isPickerOpen}
						searchValue={searchValue}
						onVariableSelect={onVariableSelect}
						useLocationVariables={!!useLocationVariables}
					/>
				) : (
					<CInput
						type="text"
						disabled={disabled}
						value={showValue}
						style={extraStyle}
						title={tooltip}
						onChange={doOnChange}
						onFocus={() => setTmpValue(value ?? '')}
						onBlur={() => setTmpValue(null)}
						placeholder={placeholder}
					/>
				)}
			</VariablesSelectContext.Provider>
		</>
	)
})

function useIsPickerOpen(showValue: string, cursorPosition: number | null) {
	const [isForceHidden, setIsForceHidden] = useState(false)

	let isPickerOpen = false
	let searchValue = ''

	if (cursorPosition != null) {
		const lastOpenSequence = FindVariableStartIndexFromCursor(showValue, cursorPosition)
		isPickerOpen = lastOpenSequence !== -1

		searchValue = showValue.slice(lastOpenSequence + 2, cursorPosition)
	}

	const previousIsPickerOpen = useRef(false)
	if (isPickerOpen !== previousIsPickerOpen.current) {
		// Clear the force hidden after a short delay (it doesn't work to call it directly)
		setTimeout(() => setIsForceHidden(false), 1)
	}
	previousIsPickerOpen.current = isPickerOpen

	return {
		searchValue,
		isPickerOpen: !isForceHidden && isPickerOpen,
		setIsForceHidden,
	}
}

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
				suggestions.push({
					value: `${connectionLabel}:${name}`,
					label: va.label,
				})
			}
		}

		if (useLocationVariables) {
			suggestions.push(
				{
					value: 'this:page',
					label: 'This page',
				},
				{
					value: 'this:column',
					label: 'This column',
				},
				{
					value: 'this:row',
					label: 'This row',
				},
				{
					value: 'this:page_name',
					label: 'This page name',
				}
			)
		}

		return suggestions
	}, [variableDefinitionsContext, useLocationVariables])

	return (
		<Select
			className="variable-select-root"
			menuPortalTarget={menuPortal || document.body}
			menuShouldBlockScroll={!!menuPortal} // The dropdown doesn't follow scroll when in a modal
			menuPosition="fixed"
			menuPlacement="auto"
			isSearchable
			isMulti={false}
			options={options}
			value={null}
			inputValue={searchValue}
			onChange={onVariableSelect}
			menuIsOpen={isOpen}
			components={{
				Option: CustomOption,
				ValueContainer: CustomValueContainer,
				Control: CustomControl,
				IndicatorsContainer: EmptyComponent,
			}}
			backspaceRemovesValue={false}
			// onKeyDown={(e) => {
			// 	// e.preventDefault()
			// }}
		/>
	)
}

const VariablesSelectContext = React.createContext({
	value: '',
	setValue: (_e: React.ChangeEvent<HTMLInputElement> | React.FormEvent<HTMLInputElement>) => {},
	setTmpValue: (_val: string | null) => {},
	setCursorPosition: (_pos: number | null) => {},
	extraStyle: {} as React.CSSProperties,
	forceHideSuggestions: (hidden: boolean) => {},
})

const CustomOption = (props: OptionProps<DropdownChoiceInt>) => {
	const { data } = props
	return (
		<SelectComponents.Option {...props} className={(props.className ?? '') + 'variable-suggestion-option'}>
			<span className="var-name">{data.value}</span>
			<span className="var-label">{data.label}</span>
		</SelectComponents.Option>
	)
}

const EmptyComponent = () => null

const CustomControl = (props: ControlProps<DropdownChoiceInt>) => {
	return (
		<SelectComponents.Control {...props} className={(props.className ?? '') + ' variables-text-input'}>
			{props.children}
		</SelectComponents.Control>
	)
}

const CustomValueContainer = (props: ValueContainerProps<DropdownChoiceInt>) => {
	const context = useContext(VariablesSelectContext)

	const checkCursor = useCallback(
		(
			e:
				| React.KeyboardEvent<HTMLInputElement>
				| React.MouseEvent<HTMLInputElement>
				| React.TouchEvent<HTMLInputElement>
				| React.ClipboardEvent<HTMLInputElement>
				| React.FocusEvent<HTMLInputElement>
		) => {
			const target = e.currentTarget

			if (document.activeElement !== target) {
				context.setCursorPosition(null)
			} else {
				context.setCursorPosition(target.selectionStart)
			}
		},
		[context.setCursorPosition]
	)

	const onFocus = useCallback(
		(e: React.FocusEvent<HTMLInputElement>) => {
			context.setTmpValue(context.value ?? '')

			checkCursor(e)
		},
		[context, checkCursor]
	)
	const onBlur = useCallback(
		(e: React.FocusEvent<HTMLInputElement>) => {
			context.setTmpValue(null)

			checkCursor(e)
			context.forceHideSuggestions(false)
		},
		[context, checkCursor]
	)
	const onKeyDown = useCallback(
		(e: React.KeyboardEvent<HTMLInputElement>) => {
			if (e.code === 'Escape') {
				context.forceHideSuggestions(true)
			} else {
				checkCursor(e)
			}
		},
		[context, checkCursor]
	)

	return (
		<SelectComponents.ValueContainer {...props} isDisabled>
			<CInput
				// {...props.innerProps}
				type="text"
				// disabled={disabled}
				style={context.extraStyle}
				// title={tooltip}
				value={context.value}
				onChange={context.setValue}
				onFocus={onFocus}
				onBlur={onBlur}
				// placeholder={placeholder}

				onKeyUp={checkCursor}
				onKeyDown={onKeyDown}
				onMouseDown={checkCursor}
				onTouchStart={checkCursor}
				onInput={checkCursor}
				onPaste={checkCursor}
				onCut={checkCursor}
				onSelect={checkCursor}
			/>
		</SelectComponents.ValueContainer>
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

	return previousOpen
}
