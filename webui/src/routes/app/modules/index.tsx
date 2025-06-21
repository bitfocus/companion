import { faPuzzlePiece } from '@fortawesome/free-solid-svg-icons'
import { createFileRoute } from '@tanstack/react-router'
import React from 'react'
import { NonIdealState } from '~/Components/NonIdealState.js'
import { MyErrorBoundary } from '~/util.js'

export const Route = createFileRoute('/_app/modules/')({
	component: RouteComponent,
})

function RouteComponent() {
	return (
		<div className="secondary-panel-simple-body">
			<MyErrorBoundary>
				<NonIdealState text="Select a module to manage" icon={faPuzzlePiece} />
			</MyErrorBoundary>
		</div>
	)
}
