import React, { useContext, useMemo } from 'react'
import { DropdownInputField } from '../Components'
import { MAX_BUTTONS } from '../Constants'
import {
	CustomVariableDefinitionsContext,
	InstancesContext,
	PagesContext,
	SurfacesContext,
	TriggersContext,
	VariableDefinitionsContext,
} from '../util'

export function InternalInstanceField(option, isOnBank, readonly, value, setValue) {
	switch (option.type) {
		case 'internal:instance_id':
			return (
				<InternalInstanceIdDropdown
					disabled={readonly}
					value={value}
					includeAll={option.includeAll}
					multiple={option.multiple}
					setValue={setValue}
					filterActionsRecorder={option.filterActionsRecorder}
				/>
			)
		case 'internal:page':
			return (
				<InternalPageDropdown
					disabled={readonly}
					isOnBank={isOnBank}
					includeDirection={option.includeDirection}
					value={value}
					setValue={setValue}
				/>
			)
		case 'internal:bank':
			return <InternalBankDropdown disabled={readonly} isOnBank={isOnBank} value={value} setValue={setValue} />
		case 'internal:custom_variable':
			return (
				<InternalCustomVariableDropdown
					disabled={readonly}
					value={value}
					setValue={setValue}
					includeNone={option.includeNone}
				/>
			)
		case 'internal:variable':
			return <InternalVariableDropdown disabled={readonly} value={value} setValue={setValue} />
		case 'internal:surface_serial':
			return (
				<InternalSurfaceBySerialDropdown disabled={readonly} isOnBank={isOnBank} value={value} setValue={setValue} />
			)
		case 'internal:trigger':
			return <InternalTriggerDropdown disabled={readonly} value={value} setValue={setValue} />
		default:
			// Use fallback
			return undefined
	}
}

function InternalInstanceIdDropdown({ includeAll, value, setValue, disabled, multiple, filterActionsRecorder }) {
	const context = useContext(InstancesContext)

	const choices = useMemo(() => {
		const instance_choices = []
		if (includeAll) {
			instance_choices.push({ id: 'all', label: 'All Instances' })
		}

		for (const [id, config] of Object.entries(context)) {
			if (filterActionsRecorder && !config.hasRecordActionsHandler) continue

			instance_choices.push({ id, label: config.label ?? id })
		}
		return instance_choices
	}, [context, includeAll, filterActionsRecorder])

	return (
		<DropdownInputField disabled={disabled} value={value} choices={choices} multiple={!!multiple} setValue={setValue} />
	)
}

function InternalPageDropdown({ isOnBank, includeDirection, value, setValue, disabled }) {
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

	return <DropdownInputField disabled={disabled} value={value} choices={choices} multiple={false} setValue={setValue} />
}

function InternalBankDropdown({ isOnBank, value, setValue, disabled }) {
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

	return <DropdownInputField disabled={disabled} value={value} choices={choices} multiple={false} setValue={setValue} />
}

export function InternalCustomVariableDropdown({ value, setValue, includeNone, disabled }) {
	const context = useContext(CustomVariableDefinitionsContext)
	const choices = useMemo(() => {
		const choices = []

		if (includeNone) {
			choices.push({
				id: '',
				label: 'None',
			})
		}

		for (const [id, info] of Object.entries(context)) {
			choices.push({
				id,
				label: `${info.description} (${id})`,
			})
		}

		return choices
	}, [context, includeNone])

	return <DropdownInputField disabled={disabled} value={value} choices={choices} multiple={false} setValue={setValue} />
}

function InternalVariableDropdown({ value, setValue, disabled }) {
	const context = useContext(VariableDefinitionsContext)
	const choices = useMemo(() => {
		const choices = []

		for (const [instanceLabel, variables] of Object.entries(context)) {
			for (const [name, variable] of Object.entries(variables || {})) {
				const id = `${instanceLabel}:${name}`
				choices.push({
					id,
					label: `${variable.label} (${id})`,
				})
			}
		}

		choices.sort((a, b) => a.id.localeCompare(b.id))

		return choices
	}, [context])

	return <DropdownInputField disabled={disabled} value={value} choices={choices} multiple={false} setValue={setValue} />
}

function InternalSurfaceBySerialDropdown({ isOnBank, value, setValue, disabled }) {
	const context = useContext(SurfacesContext)

	const choices = useMemo(() => {
		const choices = []
		if (isOnBank) {
			choices.push({ id: 'self', label: 'Current surface' })
		}

		for (const surface of Object.values(context?.available ?? {})) {
			choices.push({
				label: `${surface.name || surface.type} (${surface.id})`,
				id: surface.id,
			})
		}

		for (const surface of Object.values(context?.offline ?? {})) {
			choices.push({
				label: `${surface.name || surface.type} (${surface.id}) - Offline`,
				id: surface.id,
			})
		}
		return choices
	}, [context, isOnBank])

	return <DropdownInputField disabled={disabled} value={value} choices={choices} multiple={false} setValue={setValue} />
}

function InternalTriggerDropdown({ value, setValue, disabled }) {
	const context = useContext(TriggersContext)

	const choices = useMemo(() => {
		const choices = []
		for (const trigger of Object.values(context)) {
			choices.push({
				id: trigger.id,
				label: trigger.title || `Trigger #${trigger.id}`,
			})
		}
		return choices
	}, [context])

	return <DropdownInputField disabled={disabled} value={value} choices={choices} multiple={false} setValue={setValue} />
}
