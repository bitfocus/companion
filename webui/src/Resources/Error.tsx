import { CAlert, CButton } from '@coreui/react'
import React from 'react'
import { ErrorBoundary, type FallbackProps } from 'react-error-boundary'
import { stringifyError } from '@companion-app/shared/Stringify.js'

export function ErrorFallback({ error, resetErrorBoundary }: FallbackProps): React.JSX.Element {
	return (
		<CAlert color="danger">
			<p>Something went wrong:</p>
			<pre>{stringifyError(error, true)}</pre>
			<CButton color="primary" size="sm" onClick={resetErrorBoundary}>
				Try again
			</CButton>
		</CAlert>
	)
}

export function MyErrorBoundary({ children }: React.PropsWithChildren): React.JSX.Element {
	return <ErrorBoundary FallbackComponent={ErrorFallback}>{children}</ErrorBoundary>
}
