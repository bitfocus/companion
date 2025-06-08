import { CRow } from '@coreui/react'
import { createFileRoute, Outlet } from '@tanstack/react-router'
import React from 'react'
import { TRPCConnectionStatus, useTRPCConnectionStatus } from '~/Hooks/useTRPCConnectionStatus'
import { LoadingRetryOrError } from '~/util'

export const Route = createFileRoute('/emulator')({
	component: RouteComponent,
})

function RouteComponent() {
	const status = useTRPCConnectionStatus()

	return (
		<div className="page-emulator-base">
			{status.status === TRPCConnectionStatus.Connected ? (
				<Outlet />
			) : (
				<CRow className={'loading'}>
					<LoadingRetryOrError dataReady={false} error={status.error} />
				</CRow>
			)}
		</div>
	)
}
