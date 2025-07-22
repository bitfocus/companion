import React, { useEffect, useState } from 'react'
import { PRIMARY_COLOR } from './Constants.js'
import { BarLoader, PuffLoader } from 'react-spinners'
import type { LoaderHeightWidthProps } from 'react-spinners/helpers/props.js'
import { TRPCClientErrorLike } from '@trpc/client'
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
	autoRetryAfter?: number | null
	design: 'bar' | 'pulse' | 'pulse-xl'
}
export function LoadingRetryOrError({
	error,
	dataReady,
	doRetry,
	autoRetryAfter = null,
	design,
}: LoadingRetryOrErrorProps): React.JSX.Element {
	const [countdown, setCountdown] = useState(autoRetryAfter)

	useEffect(() => {
		if (!dataReady && autoRetryAfter) {
			const interval = setInterval(() => {
				setCountdown((c) => {
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

	useEffect(() => {
		if (countdown === 0 && doRetry) {
			doRetry()
		}
	}, [countdown, doRetry])

	return (
		<>
			{error && (
				<CCol sm={12}>
					<CAlert color="danger" role="alert">
						<p>{typeof error === 'string' ? error : error.message}</p>
						{!dataReady && (
							<CButton color="primary" onClick={doRetry}>
								Retry {countdown && '(' + countdown + ')'}
							</CButton>
						)}
					</CAlert>
				</CCol>
			)}
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
