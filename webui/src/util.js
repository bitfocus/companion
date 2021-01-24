import React from 'react'
import shortid from 'shortid'
import pTimeout from 'p-timeout'

export const CompanionContext = React.createContext({
	socket: undefined,
})

export function socketEmit(socket, name, args, timeout) {
	const p = new Promise((resolve, reject) => {
		const id = shortid()

		console.log('send', name, id)

		socket.once(id, (...res) => {
			console.log('got', id)
			resolve(res)
		})

		socket.emit(name, id, ...args)
	})

	return pTimeout(p, timeout ?? 5000)
}
