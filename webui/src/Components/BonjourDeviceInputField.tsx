import React, { useContext, useRef, useState, useMemo, useEffect } from 'react'
import { SocketContext, socketEmitPromise } from '../util'
import { DropdownInputField } from './DropdownInputField'
import type { DropdownChoice, DropdownChoiceId } from '@companion-module/base'
import type { ClientBonjourService } from '@companion/shared/Model/Common'

interface BonjourDeviceInputFieldProps {
	value: string
	setValue: (value: DropdownChoiceId) => void
	connectionId: string
	queryId: string
}

export function BonjourDeviceInputField({ value, setValue, connectionId, queryId }: BonjourDeviceInputFieldProps) {
	const socket = useContext(SocketContext)

	const [_subId, setSubId] = useState<string | null>(null)
	const subIdRef = useRef(null)

	const [services, setServices] = useState<Record<string, ClientBonjourService | undefined>>({})

	// Listen for data
	useEffect(() => {
		const onUp = (svc: ClientBonjourService) => {
			if (svc.subId !== subIdRef.current) return

			// console.log('up', svc)

			setServices((svcs) => {
				return {
					...svcs,
					[svc.fqdn]: svc,
				}
			})
		}
		const onDown = (svc: ClientBonjourService) => {
			if (svc.subId !== subIdRef.current) return

			// console.log('down', svc)

			setServices((svcs) => {
				const res = { ...svcs }
				delete res[svc.fqdn]
				return res
			})
		}

		socket.on('bonjour:service:up', onUp)
		socket.on('bonjour:service:down', onDown)

		return () => {
			socket.off('bonjour:service:up', onUp)
			socket.off('bonjour:service:down', onDown)
		}
	}, [])

	// Start/Stop the subscription
	useEffect(() => {
		let killed = false
		let mySubId: string | null = null
		socketEmitPromise(socket, 'bonjour:subscribe', [connectionId, queryId])
			.then((newSubId) => {
				// Make sure it hasnt been terminated
				if (killed) {
					socket.emit('bonjour:unsubscribe', [newSubId])
					return
				}

				// Sub is good, set it up
				mySubId = newSubId
				subIdRef.current = newSubId
				setSubId(newSubId)
				setServices({})
			})
			.catch((e) => {
				console.error('Bonjour subscription failed: ', e)
			})

		return () => {
			killed = true

			subIdRef.current = null
			setSubId(null)
			setServices({})

			if (mySubId) socket.emit('bonjour:unsubscribe', mySubId)
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

	return <DropdownInputField<false> value={value} setValue={setValue} choices={choices} multiple={false} />
}
