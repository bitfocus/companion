import React, {  } from 'react'
import { Cloud } from './Cloud'
import { StaticContext } from './util'

export function CloudPage() {
	return (
		<>
			<StaticContext.Consumer>{({ socket }) => <Cloud socket={socket} />}</StaticContext.Consumer>
		</>
	)
}
