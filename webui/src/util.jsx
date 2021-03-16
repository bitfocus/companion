import React, { useEffect } from 'react'
import pTimeout from 'p-timeout'
import { CAlert, CButton, CCol } from '@coreui/react'
import { ErrorBoundary } from 'react-error-boundary'
import { PRIMARY_COLOR } from './Constants'
import { BarLoader } from 'react-spinners'

export const SERVER_URL = window.SERVER_URL === '%REACT_APP_SERVER_URL%' ? undefined : window.SERVER_URL

export const CompanionContext = React.createContext({
	socket: undefined,
})

export function socketEmit(socket, name, args, timeout, timeoutMessage) {
	const p = new Promise((resolve, reject) => {
		console.log('send', name, ...args)

		socket.emit(name, ...args, (...res) => resolve(res))
	})

	timeout = timeout ?? 5000
	return pTimeout(p, timeout, timeoutMessage ?? `Timed out after ${timeout / 1000}s`)
}

function ErrorFallback({ error, resetErrorBoundary }) {
	return (
		<CAlert color="danger">
			<p>Something went wrong:</p>
			<pre>{error.message}</pre>
			<CButton color="primary" size="sm" onClick={resetErrorBoundary}>
				Try again
			</CButton>
		</CAlert>
	)
}

export function MyErrorBoundary({ children }) {
	return <ErrorBoundary FallbackComponent={ErrorFallback}>{children}</ErrorBoundary>
}

export function KeyReceiver({ children, ...props }) {
	return (
		<div {...props} style={{ ...props.style, outline: 'none' }}>
			{children}
		</div>
	)
}

// eslint-disable-next-line react-hooks/exhaustive-deps
export const useMountEffect = (fun) => useEffect(fun, [])

export function LoadingBar(props) {
	return (
		<BarLoader
			loading={true}
			height={4}
			width="50%"
			css={{ margin: '0 auto', display: 'inherit' }}
			color={PRIMARY_COLOR}
			{...props}
		/>
	)
}

export function LoadingRetryOrError({ error, dataReady, doRetry }) {
	return (
		<>
			{error ? (
				<CCol sm={12}>
					<CAlert color="danger" role="alert">
						<p>{error}</p>
						{!dataReady ? (
							<CButton color="primary" onClick={doRetry}>
								Retry
							</CButton>
						) : (
							''
						)}
					</CAlert>
				</CCol>
			) : (
				''
			)}
			{!dataReady && !error ? (
				<CCol sm={12}>
					<LoadingBar />
				</CCol>
			) : (
				''
			)}
		</>
	)
}
