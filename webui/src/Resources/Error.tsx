import { ErrorBoundary, type FallbackProps } from 'react-error-boundary'
import { stringifyError } from '@companion-app/shared/Stringify.js'
import { StaticAlert } from '~/Components/Alert'
import { Button } from '~/Components/Button'

export function ErrorFallback({ error, resetErrorBoundary }: FallbackProps): React.JSX.Element {
	return (
		<StaticAlert color="danger">
			<p>Something went wrong:</p>
			<pre>{stringifyError(error, true)}</pre>
			<Button color="primary" size="sm" onClick={resetErrorBoundary}>
				Try again
			</Button>
		</StaticAlert>
	)
}

export function MyErrorBoundary({ children }: React.PropsWithChildren): React.JSX.Element {
	return <ErrorBoundary FallbackComponent={ErrorFallback}>{children}</ErrorBoundary>
}
