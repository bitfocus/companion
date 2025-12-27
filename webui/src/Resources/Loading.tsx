import React, { useEffect, useState } from 'react'
import { PRIMARY_COLOR } from './Constants.js'
import { BarLoader, PuffLoader } from 'react-spinners'
import type { LoaderHeightWidthProps } from 'react-spinners/helpers/props.js'
import type { TRPCClientErrorLike } from '@trpc/client'
import { CCol, CAlert, CButton } from '@coreui/react'

type LoadingBarProps = LoaderHeightWidthProps
export function LoadingBar(props: LoadingBarProps): React.JSX.Element {
	return (
		<BarLoader
			loading={true}
			height={4}
			width="50%"
			cssOverride={{ margin: '0 auto', display: 'inherit' }}
			color={PRIMARY_COLOR}
			{...props}
		/>
	)
}

interface LoadingRetryOrErrorProps {
	error?: string | TRPCClientErrorLike<any> | null
	dataReady: boolean
	doRetry?: () => void
	retryLabel?: string
	/** Number of seconds to wait before automatically retrying. When set, a countdown timer is shown and doRetry() is called when it reaches 0. If null, no automatic retry occurs. */
	autoRetryAfter?: number | null
	design: 'bar' | 'pulse' | 'pulse-xl'
}
export function LoadingRetryOrError({
	error,
	dataReady,
	doRetry,
	retryLabel,
	autoRetryAfter = null,
	design,
}: LoadingRetryOrErrorProps): React.JSX.Element {
	// Track the countdown timer for automatic retry
	const [countdown, setCountdown] = useState(autoRetryAfter)

	// Manage the countdown timer - decrements every second when data is not ready and autoRetryAfter is set
	useEffect(() => {
		if (!dataReady && autoRetryAfter) {
			const interval = setInterval(() => {
				setCountdown((c) => {
					// Reset to initial countdown value when timer expires or is not set
					if (!c || c <= 0) {
						return autoRetryAfter - 1
					} else {
						return c - 1
					}
				})
			}, 1000)
			return () => clearInterval(interval)
		} else {
			setCountdown(null)
			return
		}
	}, [dataReady, autoRetryAfter])

	// Trigger the retry callback when countdown reaches 0
	useEffect(() => {
		if (countdown === 0 && doRetry) {
			doRetry()
		}
	}, [countdown, doRetry])

	return (
		<>
			{/* Show error message with manual retry button */}
			{error && (
				<CCol sm={12}>
					<CAlert color="danger" role="alert">
						<p>{typeof error === 'string' ? error : error.message}</p>
						{/* Show retry button with countdown when data is not ready and retry function is provided */}
						{!dataReady && !!doRetry && (
							<CButton color="primary" onClick={doRetry}>
								{retryLabel || 'Retry'} {countdown && '(' + countdown + ')'}
							</CButton>
						)}
					</CAlert>
				</CCol>
			)}
			{/* Show loading spinner when data is not ready and there's no error */}
			{!dataReady && !error && (
				<CCol sm={12}>
					{design === 'pulse' ? (
						<div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '200px' }}>
							<PuffLoader loading={true} size={80} color={PRIMARY_COLOR} />
						</div>
					) : design === 'pulse-xl' ? (
						<div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '200px' }}>
							<PuffLoader loading={true} size={160} color={PRIMARY_COLOR} />
						</div>
					) : (
						<LoadingBar />
					)}
				</CCol>
			)}
		</>
	)
}
