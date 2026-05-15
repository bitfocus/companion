import { CButton } from '@coreui/react'
import { ErrorBoundary, type FallbackProps } from 'react-error-boundary'
import { stringifyError } from '@companion-app/shared/Stringify.js'
import { StaticAlert } from '~/Components/Alert'

export function ErrorFallback({ error, resetErrorBoundary }: FallbackProps): React.JSX.Element {
	return (
		<StaticAlert color="danger">
			<p>Something went wrong:</p>
			<pre>{stringifyError(error, true)}</pre>
			<CButton color="primary" size="sm" onClick={resetErrorBoundary}>
				Try again
			</CButton>
		</StaticAlert>
	)
}

export function MyErrorBoundary({ children }: React.PropsWithChildren): React.JSX.Element {
	return <ErrorBoundary FallbackComponent={ErrorFallback}>{children}</ErrorBoundary>
}
