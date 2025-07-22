import { CAlert, CButton } from '@coreui/react'
import React from 'react'
import { ErrorBoundary } from 'react-error-boundary'

interface ErrorFallbackProps {
	error: Error | undefined
	resetErrorBoundary: () => void
}
export function ErrorFallback({ error, resetErrorBoundary }: ErrorFallbackProps): React.JSX.Element {
	return (
		<CAlert color="danger">
			<p>Something went wrong:</p>
			<pre>{error?.message ?? ''}</pre>
			<CButton color="primary" size="sm" onClick={resetErrorBoundary}>
				Try again
			</CButton>
		</CAlert>
	)
}

export function MyErrorBoundary({ children }: React.PropsWithChildren): React.JSX.Element {
	return <ErrorBoundary FallbackComponent={ErrorFallback}>{children}</ErrorBoundary>
}
