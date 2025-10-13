import React from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { AddSurfaceInstancePanel } from '~/Surfaces/Instances/AddSurfaceInstancePanel.js'

export const Route = createFileRoute('/_app/surfaces/instances/add')({
	component: RouteComponent,
})

function RouteComponent() {
	return <AddSurfaceInstancePanel />
}
