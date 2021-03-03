import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { CompanionContext } from '../util'
import Tribute from 'tributejs'
import { CInput } from '@coreui/react'

export function TextWithVariablesInputField({ definition, value, setValue }) {
	const context = useContext(CompanionContext)

	const [tmpValue, setTmpValue] = useState(null)

	// If the value is undefined, populate with the default. Also inform the parent about the validity
	useEffect(() => {
		if (value === undefined && definition.default !== undefined) {
			setValue(definition.default)
		}
	}, [definition.default, value, setValue])

	// const elmRef = useRef()

	const tribute = useMemo(() => {
		const suggestions = []
		for (const [instanceLabel, variables] of Object.entries(context.variableDefinitions)) {
			for (const va of variables) {
				const variableId = `${instanceLabel}:${va.name}`
				suggestions.push({
					key: variableId + ')',
					value: variableId,
					label: va.label,
				})
			}
		}

		return new Tribute({
			values: suggestions,
			trigger: '$(',

			// function called on select that returns the content to insert
			selectTemplate: (item) => `$(${item.original.value})`,

			// template for displaying item in menu
			menuItemTemplate: (item) =>
				`<span class="var-name">${item.original.value}</span><span class="var-label">${item.original.label}</span>`,
		})
	}, [context.variableDefinitions])

	const doOnChange = useCallback(
		(e) => {
			setTmpValue(e.currentTarget.value)
			setValue(e.currentTarget.value)
		},
		[setValue]
	)

	const setupTribute = useCallback(
		(ref) => {
			if (ref) {
				tribute.attach(ref)
				ref.addEventListener('tribute-replaced', doOnChange)
			}
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
