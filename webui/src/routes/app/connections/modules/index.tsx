import { faPuzzlePiece } from '@fortawesome/free-solid-svg-icons'
import { createFileRoute } from '@tanstack/react-router'
import React from 'react'
import { NonIdealState } from '~/Components/NonIdealState.js'
import { MyErrorBoundary } from '~/Resources/Error'

export const Route = createFileRoute('/_app/connections/modules/')({
	component: RouteComponent,
})

function RouteComponent() {
	return (
		<MyErrorBoundary>
			<NonIdealState text="Select a module to manage" icon={faPuzzlePiece} />
		</MyErrorBoundary>
	)
}
