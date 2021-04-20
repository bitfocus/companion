import React, {  } from 'react'
import { Cloud } from './Cloud'
import { CompanionContext } from './util'

export function CloudPage() {
	return (
		<>
			<CompanionContext.Consumer>{({ socket }) => <Cloud socket={socket} />}</CompanionContext.Consumer>
		</>
	)
}
