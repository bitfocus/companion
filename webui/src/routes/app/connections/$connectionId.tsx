import { createFileRoute, useNavigate } from '@tanstack/react-router'
import React, { useContext, useState } from 'react'
import { useComputed } from '~/Resources/util.js'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import { observer } from 'mobx-react-lite'
import { ConnectionEditPanel } from '~/Connections/ConnectionEdit/ConnectionEditPanel'
import { nanoid } from 'nanoid'

const RouteComponent = observer(function RouteComponent() {
	const { connectionId } = Route.useParams()

	const { connections } = useContext(RootAppStoreContext)

	const navigate = useNavigate({ from: '/connections/$connectionId' })

	const [tabResetToken] = useState<string>(nanoid())

	// Ensure the selected connection is valid
	useComputed(() => {
		if (!connections.connections.has(connectionId)) {
			void navigate({ to: `/connections` })
		}
	}, [navigate, connections, connectionId])

	return <ConnectionEditPanel key={tabResetToken} connectionId={connectionId} />
})

export const Route = createFileRoute('/_app/connections/$connectionId')({
	component: RouteComponent,
})
