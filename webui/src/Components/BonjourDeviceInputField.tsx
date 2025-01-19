import React, { useContext, useRef, useState, useMemo, useEffect } from 'react'
import { SocketContext } from '../util.js'
import { DropdownInputField } from './DropdownInputField.js'
import type { DropdownChoice, DropdownChoiceId } from '@companion-module/base'
import type { ClientBonjourService } from '@companion-app/shared/Model/Common.js'

interface BonjourDeviceInputFieldProps {
	label: React.ReactNode
	value: string
	setValue: (value: DropdownChoiceId) => void
	connectionId: string
	queryId: string
}

export function BonjourDeviceInputField({
	label,
	value,
	setValue,
	connectionId,
	queryId,
}: BonjourDeviceInputFieldProps) {
	const socket = useContext(SocketContext)

	const [_subIds, setSubIds] = useState<string[] | null>(null)
	const subIdsRef = useRef<string[] | null>(null)

	const [services, setServices] = useState<Record<string, ClientBonjourService | undefined>>({})

	// Listen for data
	useEffect(() => {
		const unsubUp = socket.on('bonjour:service:up', (svc) => {
			if (!subIdsRef.current?.includes(svc.subId)) return

			// console.log('up', svc)
			setServices((svcs) => {
				return {
					...svcs,
					[svc.fqdn]: svc,
				}
			})
		})
		const unsubDown = socket.on('bonjour:service:down', (subId, fqdn) => {
			if (!subIdsRef.current?.includes(subId)) return

			// console.log('down', svc)
			setServices((svcs) => {
				const res = { ...svcs }
				delete res[fqdn]
				return res
			})
		})

		return () => {
			unsubUp()
			unsubDown()
		}
	}, [])

	// Start/Stop the subscription
	useEffect(() => {
		let killed = false
		let mySubIds: string[] | null = null
		socket
			.emitPromise('bonjour:subscribe', [connectionId, queryId])
			.then((newSubIds) => {
				// Make sure it hasnt been terminated
				if (killed) {
					socket.emit('bonjour:unsubscribe', newSubIds)
					return
				}

				// Sub is good, set it up
				mySubIds = newSubIds
				subIdsRef.current = newSubIds
				setSubIds(newSubIds)
				setServices({})
			})
			.catch((e) => {
				console.error('Bonjour subscription failed: ', e)
			})

		return () => {
			killed = true

			subIdsRef.current = null
			setSubIds(null)
			setServices({})

			if (mySubIds) socket.emit('bonjour:unsubscribe', mySubIds)
		}
	}, [socket, connectionId, queryId])

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

	return (
		<DropdownInputField<false> label={label} value={value} setValue={setValue} choices={choices} multiple={false} />
	)
}
