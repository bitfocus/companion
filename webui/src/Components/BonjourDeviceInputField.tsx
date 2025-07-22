import React, { useState, useMemo } from 'react'
import { DropdownInputField } from './DropdownInputField.js'
import type { DropdownChoice, DropdownChoiceId } from '@companion-module/base'
import type { ClientBonjourService } from '@companion-app/shared/Model/Common.js'
import { useSubscription } from '@trpc/tanstack-react-query'
import { trpc } from '~/Resources/TRPC.js'

interface BonjourDeviceInputFieldProps {
	value: string
	setValue: (value: DropdownChoiceId) => void
	connectionId: string
	queryId: string
}

export function BonjourDeviceInputField({
	value,
	setValue,
	connectionId,
	queryId,
}: BonjourDeviceInputFieldProps): React.JSX.Element {
	const [services, setServices] = useState<Record<string, ClientBonjourService | undefined>>({})

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

		choices.push({ id: null as any, label: 'Manual' })

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

		if (!choices.find((opt) => opt.id == value)) {
			choices.push({
				id: value,
				label: `*Unavailable* (${value})`,
			})
		}

		return choices
	}, [choicesRaw, value])

	return <DropdownInputField value={value} setValue={setValue} choices={choices} />
}
