import { CRow } from '@coreui/react'
import { createFileRoute, Outlet } from '@tanstack/react-router'
import { useSubscription } from '@trpc/tanstack-react-query'
import React from 'react'
import { useDocumentTitle } from 'usehooks-ts'
import { TRPCConnectionStatus, useTRPCConnectionStatus } from '~/Hooks/useTRPCConnectionStatus'
import { trpc } from '~/TRPC'
import { LoadingRetryOrError } from '~/util'

export const Route = createFileRoute('/emulator')({
	component: RouteComponent,
})

function RouteComponent() {
	const status = useTRPCConnectionStatus()

	const emulatorPageConfig = useSubscription(trpc.surfaces.emulatorPageConfig.subscriptionOptions())

	useDocumentTitle(
		emulatorPageConfig.data?.installName && emulatorPageConfig.data.installName.length > 0
			? `${emulatorPageConfig.data.installName} - Emulator (Bitfocus Companion)`
			: 'Bitfocus Companion - Emulator'
	)

	return (
		<div className="page-emulator-base">
			{status.status === TRPCConnectionStatus.Connected || !emulatorPageConfig.data ? (
				<Outlet />
			) : (
				<CRow className={'loading'}>
					<LoadingRetryOrError dataReady={false} error={status.error || emulatorPageConfig.error} />
				</CRow>
			)}
		</div>
	)
}
