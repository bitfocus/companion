import { createContext, useRef, useState } from 'react'
import { useContext } from 'react'
import { useMemo, useEffect } from 'react'
import { SocketContext, socketEmitPromise } from '../util'
import { DropdownInputField } from './DropdownInputField'

export const MenuPortalContext = createContext(null)

export function BonjourDeviceInputField({ value, setValue, filter }) {
	const socket = useContext(SocketContext)

	const [_subId, setSubId] = useState(null)
	const subIdRef = useRef(null)

	const [services, setServices] = useState({})

	// Listen for data
	useEffect(() => {
		const onUp = (svc) => {
			if (svc.subId !== subIdRef.current) return

			// console.log('up', svc)

			setServices((svcs) => {
				return {
					...svcs,
					[svc.fqdn]: svc,
				}
			})
		}
		const onDown = (svc) => {
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
		let mySubId = null
		socketEmitPromise(socket, 'bonjour:subscribe', [filter])
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
	}, [socket, filter])

	const choicesRaw = useMemo(() => {
		const choices = []

		choices.push({ id: null, label: 'Manual' })

		for (const svc of Object.values(services)) {
			const address = `${svc.host}:${svc.port}`
			choices.push({
				id: address,
				label: `${svc.name} (${address})`,
			})
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
