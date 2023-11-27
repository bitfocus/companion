import React, { useContext } from 'react'
import { Cloud } from './Cloud'
import { SocketContext } from './util'

export function CloudPage() {
	const socket = useContext(SocketContext)
	return <Cloud socket={socket} />
}
