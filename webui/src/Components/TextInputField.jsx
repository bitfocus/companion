import Tribute from 'tributejs'
import { useEffect, useMemo, useState, useCallback, useContext } from 'react'
import { CInput } from '@coreui/react'
import { VariableDefinitionsContext } from '../util'

export function TextInputField({
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
	useInternalLocationVariables,
}) {
	const variableDefinitionsContext = useContext(VariableDefinitionsContext)

	const [tmpValue, setTmpValue] = useState(null)

	const tribute = useMemo(() => {
		// Create it once, then we attach and detach whenever the ref changes
		return new Tribute({
			values: [],
			trigger: '$(',

			// function called on select that returns the content to insert
			selectTemplate: (item) => `$(${item.original.value})`,

			// template for displaying item in menu
			menuItemTemplate: (item) =>
				`<span class="var-name">${item.original.value}</span><span class="var-label">${item.original.label}</span>`,
		})
	}, [])

	useEffect(() => {
		// Update the suggestions list in tribute whenever anything changes
		const suggestions = []
		if (useVariables) {
			for (const [connectionLabel, variables] of Object.entries(variableDefinitionsContext)) {
				for (const [name, va] of Object.entries(variables || {})) {
					const variableId = `${connectionLabel}:${name}`
					suggestions.push({
						key: variableId + ')',
						value: variableId,
						label: va.label,
					})
				}
			}
		}

		if (useInternalLocationVariables) {
			suggestions.push(
				{
					key: 'this:page)',
					value: 'this:page',
					label: 'This page',
				},
				{
					key: 'this:column)',
					value: 'this:column',
					label: 'This column',
				},
				{
					key: 'this:row)',
					value: 'this:row',
					label: 'This row',
				}
			)
		}

		tribute.append(0, suggestions, true)
	}, [variableDefinitionsContext, tribute, useVariables, useInternalLocationVariables])

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
		(val) => {
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

	const doOnChange = useCallback(
		(e) => {
			// const newValue = decode(e.currentTarget.value, { scope: 'strict' })
			setTmpValue(e.currentTarget.value)
			setValue(e.currentTarget.value)
			setValid?.(isValueValid(e.currentTarget.value))
		},
		[setValue, setValid, isValueValid]
	)

	const [, setupTributePrevious] = useState([null, null])
	const setupTribute = useCallback(
		(ref) => {
			// we need to detach, so need to track the value manually
			setupTributePrevious(([oldRef, oldDoOnChange]) => {
				if (oldRef) {
					tribute.detach(oldRef)
					if (oldDoOnChange) {
						oldRef.removeEventListener('tribute-replaced', oldDoOnChange)
					}
				}
				if (ref) {
					tribute.attach(ref)
					ref.addEventListener('tribute-replaced', doOnChange)
				}
				return [ref, doOnChange]
			})
		},
		[tribute, doOnChange]
	)

	// Render the input
	const extraStyle = style || {}
	return (
		<CInput
			innerRef={useVariables ? setupTribute : undefined}
			type="text"
			disabled={disabled}
			value={tmpValue ?? value ?? ''}
			style={{ color: !isValueValid(tmpValue ?? value) ? 'red' : undefined, ...extraStyle }}
			title={tooltip}
			onChange={doOnChange}
			onFocus={() => setTmpValue(value ?? '')}
			onBlur={() => setTmpValue(null)}
			placeholder={placeholder}
		/>
	)
}
