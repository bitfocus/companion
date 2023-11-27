import React, { useContext, useMemo } from 'react'
import { DropdownInputField } from '../Components'
import {
	CustomVariableDefinitionsContext,
	ConnectionsContext,
	PagesContext,
	SurfacesContext,
	TriggersContext,
	VariableDefinitionsContext,
} from '../util'
import TimePicker from 'react-time-picker'
import { InternalInputField } from '@companion/shared/Model/Options'
import { DropdownChoice } from '@companion-module/base'

export function InternalInstanceField(
	option: InternalInputField,
	isOnControl: boolean,
	readonly: boolean,
	value: any,
	setValue: (value: any) => void
): JSX.Element | null {
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
					isOnControl={isOnControl}
					includeDirection={option.includeDirection}
					value={value}
					setValue={setValue}
				/>
			)
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
				<InternalSurfaceBySerialDropdown
					disabled={readonly}
					isOnControl={isOnControl}
					value={value}
					setValue={setValue}
					includeSelf={option.includeSelf}
					useRawSurfaces={option.useRawSurfaces}
				/>
			)
		case 'internal:trigger':
			return (
				<InternalTriggerDropdown
					disabled={readonly}
					isOnControl={isOnControl}
					value={value}
					setValue={setValue}
					includeSelf={option.includeSelf}
				/>
			)
		case 'internal:time':
			return <InternalTimePicker disabled={readonly} value={value} setValue={setValue} />
		default:
			// Use fallback
			return null
	}
}

interface InternalInstanceIdDropdownProps {
	includeAll: boolean | undefined
	value: any
	setValue: (value: any) => void
	disabled: boolean
	multiple: boolean
	filterActionsRecorder: boolean | undefined
}

function InternalInstanceIdDropdown({
	includeAll,
	value,
	setValue,
	disabled,
	multiple,
	filterActionsRecorder,
}: InternalInstanceIdDropdownProps) {
	const context = useContext(ConnectionsContext)

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

interface InternalPageDropdownProps {
	isOnControl: boolean
	includeDirection: boolean | undefined
	value: any
	setValue: (value: any) => void
	disabled: boolean
}

function InternalPageDropdown({ isOnControl, includeDirection, value, setValue, disabled }: InternalPageDropdownProps) {
	const pages = useContext(PagesContext)

	const choices = useMemo(() => {
		const choices: DropdownChoice[] = []
		if (isOnControl) {
			choices.push({ id: 0, label: 'This page' })
		}
		if (includeDirection) {
			choices.push({ id: 'back', label: 'Back' }, { id: 'forward', label: 'Forward' })
		}

		for (let i = 1; i <= 99; i++) {
			const name = pages?.[i]
			choices.push({ id: i, label: `${i}` + (name ? ` (${name?.name || ''})` : '') })
		}
		return choices
	}, [pages, isOnControl, includeDirection])

	return <DropdownInputField disabled={disabled} value={value} choices={choices} multiple={false} setValue={setValue} />
}

interface InternalCustomVariableDropdownProps {
	value: any
	setValue: (value: any) => void
	includeNone: boolean | undefined
	disabled: boolean
}

export function InternalCustomVariableDropdown({
	value,
	setValue,
	includeNone,
	disabled,
}: InternalCustomVariableDropdownProps) {
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

	return (
		<DropdownInputField
			disabled={disabled}
			value={value ?? ''}
			choices={choices}
			multiple={false}
			setValue={setValue}
		/>
	)
}

interface InternalVariableDropdownProps {
	value: any
	setValue: (value: any) => void
	disabled: boolean
}

function InternalVariableDropdown({ value, setValue, disabled }: InternalVariableDropdownProps) {
	const context = useContext(VariableDefinitionsContext)
	const choices = useMemo(() => {
		const choices = []

		for (const [connectionLabel, variables] of Object.entries(context)) {
			for (const [name, variable] of Object.entries(variables || {})) {
				if (!variable) continue
				const id = `${connectionLabel}:${name}`
				choices.push({
					id,
					label: `${variable.label} (${id})`,
				})
			}
		}

		choices.sort((a, b) => a.id.localeCompare(b.id))

		return choices
	}, [context])

	return (
		<DropdownInputField
			disabled={disabled}
			value={value}
			choices={choices}
			multiple={false}
			setValue={setValue}
			allowCustom /* Allow specifying a variable which doesnt currently exist, perhaps as something is offline */
		/>
	)
}

interface InternalSurfaceBySerialDropdownProps {
	isOnControl: boolean
	value: any
	setValue: (value: any) => void
	disabled: boolean
	includeSelf: boolean | undefined
	useRawSurfaces: boolean | undefined
}

function InternalSurfaceBySerialDropdown({
	isOnControl,
	value,
	setValue,
	disabled,
	includeSelf,
	useRawSurfaces,
}: InternalSurfaceBySerialDropdownProps) {
	const surfacesContext = useContext(SurfacesContext)

	const choices = useMemo(() => {
		const choices: DropdownChoice[] = []
		if (isOnControl && includeSelf) {
			choices.push({ id: 'self', label: 'Current surface' })
		}

		if (!useRawSurfaces) {
			for (const group of Object.values(surfacesContext ?? {})) {
				if (!group) continue

				choices.push({
					label: group.displayName,
					id: group.id,
				})
			}
		} else {
			for (const group of Object.values(surfacesContext ?? {})) {
				if (!group) continue

				for (const surface of group.surfaces) {
					choices.push({
						label: surface.displayName,
						id: surface.id,
					})
				}
			}
		}

		return choices
	}, [surfacesContext, isOnControl, includeSelf, useRawSurfaces])

	return <DropdownInputField disabled={disabled} value={value} choices={choices} multiple={false} setValue={setValue} />
}

interface InternalTriggerDropdownProps {
	isOnControl: boolean
	value: any
	setValue: (value: any) => void
	disabled: boolean
	includeSelf: boolean | undefined
}

function InternalTriggerDropdown({
	isOnControl,
	value,
	setValue,
	disabled,
	includeSelf,
}: InternalTriggerDropdownProps) {
	const context = useContext(TriggersContext)

	const choices = useMemo(() => {
		const choices = []
		if (!isOnControl && includeSelf) {
			choices.push({ id: 'self', label: 'Current trigger' })
		}

		for (const [id, trigger] of Object.entries(context)) {
			if (!trigger) continue

			choices.push({
				id: id,
				label: trigger.name || `Trigger #${id}`,
			})
		}
		return choices
	}, [context, isOnControl, includeSelf])

	return <DropdownInputField disabled={disabled} value={value} choices={choices} multiple={false} setValue={setValue} />
}

interface InternalTimePickerProps {
	value: any
	setValue: (value: any) => void
	disabled: boolean
}

function InternalTimePicker({ value, setValue, disabled }: InternalTimePickerProps) {
	return (
		<TimePicker
			disabled={disabled}
			format="HH:mm:ss"
			maxDetail="second"
			required
			value={value}
			onChange={setValue}
			className={''}
			openClockOnFocus={false}
		/>
	)
}
