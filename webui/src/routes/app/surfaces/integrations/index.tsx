import React from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { AddSurfaceInstancePanel } from '~/Surfaces/Instances/AddSurfaceInstancePanel.js'

export const Route = createFileRoute('/_app/surfaces/integrations/')({
	component: RouteComponent,
})

function RouteComponent() {
	return <AddSurfaceInstancePanel />
}
