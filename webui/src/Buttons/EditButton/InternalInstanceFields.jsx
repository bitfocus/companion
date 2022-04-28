import React, { useContext, useMemo } from 'react'
import { DropdownInputField } from '../../Components'
import { MAX_BUTTONS } from '../../Constants'
import {
	CustomVariableDefinitionsContext,
	InstancesContext,
	PagesContext,
	SurfacesContext,
	TriggersContext,
	VariableDefinitionsContext,
} from '../../util'

export function InternalInstanceField(option, isOnBank, value, setValue) {
	switch (option.type) {
		case 'internal:instance_id':
			return <InternalInstanceIdDropdown value={value} includeAll={option.includeAll} setValue={setValue} />
		case 'internal:page':
			return (
				<InternalPageDropdown
					isOnBank={isOnBank}
					includeDirection={option.includeDirection}
					value={value}
					setValue={setValue}
				/>
			)
		case 'internal:bank':
			return <InternalBankDropdown isOnBank={isOnBank} value={value} setValue={setValue} />
		case 'internal:custom_variable':
			return <InternalCustomVariableDropdown value={value} setValue={setValue} />
		case 'internal:variable':
			return <InternalVariableDropdown value={value} setValue={setValue} defaultVal={option.default} />
		case 'internal:surface_serial':
			return <InternalSurfaceBySerialDropdown isOnBank={isOnBank} value={value} setValue={setValue} />
		case 'internal:trigger':
			return <InternalTriggerDropdown value={value} setValue={setValue} />
		default:
			// Use fallback
			return undefined
	}
}

function InternalInstanceIdDropdown({ includeAll, value, setValue }) {
	const context = useContext(InstancesContext)

	const choices = useMemo(() => {
		const instance_choices = []
		if (includeAll) {
			instance_choices.push({ id: 'all', label: 'All Instances' })
		}

		for (const [id, config] of Object.entries(context)) {
			if (id !== 'bitfocus-companion') {
				instance_choices.push({ id, label: config.label ?? id })
			}
		}
		return instance_choices
	}, [context, includeAll])

	return (
		<DropdownInputField
			value={value}
			definition={{
				choices: choices,
				default: choices[0]?.id,
			}}
			multiple={false}
			setValue={setValue}
		/>
	)
}

function InternalPageDropdown({ isOnBank, includeDirection, value, setValue }) {
	const pages = useContext(PagesContext)

	const choices = useMemo(() => {
		const choices = []
		if (isOnBank) {
			choices.push({ id: 0, label: 'This page' })
		}
		if (includeDirection) {
			choices.push({ id: 'back', label: 'Back' }, { id: 'forward', label: 'Forward' })
		}

		for (let i = 1; i <= 99; i++) {
			const name = pages[i]
			choices.push({ id: i, label: `${i}` + (name ? ` (${name.name || ''})` : '') })
		}
		return choices
	}, [pages, isOnBank, includeDirection])

	return (
		<DropdownInputField
			value={value}
			definition={{
				choices: choices,
				default: choices[0]?.id,
			}}
			multiple={false}
			setValue={setValue}
		/>
	)
}

function InternalBankDropdown({ isOnBank, value, setValue }) {
	const choices = useMemo(() => {
		const choices = []
		if (isOnBank) {
			choices.push({ id: 0, label: 'This bank' })
		}

		for (let i = 1; i <= MAX_BUTTONS; i++) {
			choices.push({ id: i, label: `${i}` })
		}
		return choices
	}, [isOnBank])

	return (
		<DropdownInputField
			value={value}
			definition={{
				choices: choices,
				default: choices[0]?.id,
			}}
			multiple={false}
			setValue={setValue}
		/>
	)
}

function InternalCustomVariableDropdown({ value, setValue }) {
	const context = useContext(CustomVariableDefinitionsContext)
	const choices = useMemo(() => {
		const choices = []

		for (const [id, info] of Object.entries(context)) {
			choices.push({
				id,
				label: `${info.description} (${id})`,
			})
		}

		return choices
	}, [context])

	return (
		<DropdownInputField
			value={value}
			definition={{
				choices: choices,
				default: '',
			}}
			multiple={false}
			setValue={setValue}
		/>
	)
}

function InternalVariableDropdown({ value, setValue, defaultVal }) {
	const context = useContext(VariableDefinitionsContext)
	const choices = useMemo(() => {
		const choices = []

		for (const [instanceLabel, variables] of Object.entries(context)) {
			for (const variable of variables) {
				const id = `${instanceLabel}:${variable.name}`
				choices.push({
					id,
					label: `${variable.label} (${id})`,
				})
			}
		}

		return choices
	}, [context])

	return (
		<DropdownInputField
			value={value}
			definition={{
				choices: choices,
				default: defaultVal ?? choices[0]?.id ?? '',
			}}
			multiple={false}
			setValue={setValue}
		/>
	)
}

function InternalSurfaceBySerialDropdown({ isOnBank, value, setValue }) {
	const context = useContext(SurfacesContext)

	const choices = useMemo(() => {
		const choices = []
		if (isOnBank) {
			choices.push({ id: 'self', label: 'Current surface' })
		}

		for (const surface of context) {
			choices.push({
				label: `${surface.name || surface.type} (${surface.id})`,
				id: surface.id,
			})
		}
		return choices
	}, [context, isOnBank])

	return (
		<DropdownInputField
			value={value}
			definition={{
				choices: choices,
				default: choices[0]?.id,
			}}
			multiple={false}
			setValue={setValue}
		/>
	)
}

function InternalTriggerDropdown({ value, setValue }) {
	const context = useContext(TriggersContext)

	const choices = useMemo(() => {
		const choices = []
		for (const trigger of context) {
			choices.push({
				id: trigger.id,
				label: trigger.title || `Trigger #${trigger.id}`,
			})
		}
		return choices
	}, [context])

	return (
		<DropdownInputField
			value={value}
			definition={{
				choices: choices,
				default: choices[0]?.id,
			}}
			multiple={false}
			setValue={setValue}
		/>
	)
}
