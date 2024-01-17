import React, { useContext } from 'react'
import { Cloud } from './Cloud/index.js'
import { SocketContext } from './util.js'

export function CloudPage() {
	const socket = useContext(SocketContext)
	return <Cloud socket={socket} />
}
