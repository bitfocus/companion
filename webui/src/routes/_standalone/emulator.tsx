import { CRow } from '@coreui/react'
import { createFileRoute, Outlet } from '@tanstack/react-router'
import { useSubscription } from '@trpc/tanstack-react-query'
import React, { useCallback } from 'react'
import { useDocumentTitle } from 'usehooks-ts'
import { TRPCConnectionStatus, useTRPCConnectionStatus } from '~/Hooks/useTRPCConnectionStatus'
import { trpc } from '~/Resources/TRPC'
import { LoadingRetryOrError } from '~/Resources/Loading'

export const Route = createFileRoute('/_standalone/emulator')({
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

	const doRetry = useCallback(() => window.location.reload(), [])

	return (
		<div className="page-emulator-base">
			{status.status === TRPCConnectionStatus.Connected || !emulatorPageConfig.data ? (
				<Outlet />
			) : (
				<CRow className={'loading'}>
					<LoadingRetryOrError
						dataReady={false}
						error={status.error || emulatorPageConfig.error || 'test'}
						doRetry={doRetry}
						retryLabel="Reload Emulator"
						design="pulse-xl"
					/>
				</CRow>
			)}
		</div>
	)
}
