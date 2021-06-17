import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { VariableDefinitionsContext } from '../util'
import Tribute from 'tributejs'
import { CInput } from '@coreui/react'
import { decode } from 'html-entities'

export function TextWithVariablesInputField({ definition, value, setValue }) {
	const variableDefinitionsContext = useContext(VariableDefinitionsContext)

	const [tmpValue, setTmpValue] = useState(null)

	// If the value is undefined, populate with the default. Also inform the parent about the validity
	useEffect(() => {
		if (value === undefined && definition.default !== undefined) {
			setValue(definition.default)
		}
	}, [definition.default, value, setValue])

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
		for (const [instanceLabel, variables] of Object.entries(variableDefinitionsContext)) {
			for (const va of variables) {
				const variableId = `${instanceLabel}:${va.name}`
				suggestions.push({
					key: variableId + ')',
					value: variableId,
					label: va.label,
				})
			}
		}

		tribute.append(0, suggestions, true)
	}, [variableDefinitionsContext, tribute])

	const doOnChange = useCallback(
		(e) => {
			const newValue = decode(e.currentTarget.value, { scope: 'strict' })
			setTmpValue(newValue)
			setValue(newValue)
		},
		[setValue]
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

	return (
		<CInput
			innerRef={setupTribute}
			className="input-text-with-variables"
			type="text"
			value={tmpValue ?? value ?? ''}
			title={definition.tooltip}
			onChange={doOnChange}
			onFocus={() => setTmpValue(value ?? '')}
			onBlur={() => setTmpValue(null)}
		/>
	)
}
