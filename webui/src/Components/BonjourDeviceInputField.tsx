import { useSubscription } from '@trpc/tanstack-react-query'
import { useCallback, useMemo, useState } from 'react'
import type { ClientBonjourService, DropdownChoice, DropdownChoiceId } from '@companion-app/shared/Model/Common.js'
import { trpc } from '~/Resources/TRPC.js'
import { DropdownInputField } from './DropdownInputField.js'

const MANUAL_SENTINEL = ''

interface BonjourDeviceInputFieldProps {
	id: string | undefined
	value: string | null
	setValue: (value: DropdownChoiceId | null) => void
	connectionId: string
	queryId: string
}

export function BonjourDeviceInputField({
	id,
	value,
	setValue,
	connectionId,
	queryId,
}: BonjourDeviceInputFieldProps): React.JSX.Element {
	const [services, setServices] = useState<Record<string, ClientBonjourService | undefined>>({})

	// Translate null (Manual) ↔ empty string for the dropdown, which requires string | number
	const internalValue = value ?? MANUAL_SENTINEL
	const internalSetValue = useCallback(
		(v: DropdownChoiceId) => {
			setValue(v === MANUAL_SENTINEL ? null : v)
		},
		[setValue]
	)

	/*const bonjourSub = */ useSubscription(
		trpc.bonjour.watchQuery.subscriptionOptions(
			{ connectionId, queryId },
			{
				onStarted: () => {
					setServices({}) // Clear services when the subscription starts
				},
				onData: (data) => {
					// TODO - should this debounce?

					setServices((services) => {
						const newServices = { ...services }
						switch (data.type) {
							case 'up': {
								newServices[data.service.fqdn] = data.service
								break
							}
							case 'down': {
								delete newServices[data.fqdn]
								break
							}
							default:
								console.warn('Unknown bonjour event type', data)
						}

						return newServices
					})
				},
			}
		)
	)

	const choicesRaw = useMemo(() => {
		const choices: DropdownChoice[] = []

		choices.push({ id: MANUAL_SENTINEL, label: 'Manual' })

		for (const svc of Object.values(services)) {
			if (!svc) continue
			for (const rawAddress of svc.addresses || []) {
				const address = `${rawAddress}:${svc.port}`
				choices.push({
					id: address,
					label: `${svc.name} (${address})`,
				})
			}
		}

		return choices
	}, [services])

	const choices = useMemo(() => {
		const choices = [...choicesRaw]

		if (!choices.find((opt) => opt.id == internalValue)) {
			choices.push({
				id: internalValue,
				label: `*Unavailable* (${internalValue})`,
			})
		}

		return choices
	}, [choicesRaw, internalValue])

	return <DropdownInputField htmlName={id} value={internalValue} setValue={internalSetValue} choices={choices} />
}
