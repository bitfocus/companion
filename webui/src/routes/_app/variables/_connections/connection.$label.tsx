import { createFileRoute } from '@tanstack/react-router'
import { MyErrorBoundary } from '~/Resources/Error'
import { ConnectionVariablesPanel } from '~/Variables/index.js'

export const Route = createFileRoute('/_app/variables/_connections/connection/$label')({
	component: RouteComponent,
})

function RouteComponent() {
	const { label } = Route.useParams()

	return (
		<MyErrorBoundary>
			<ConnectionVariablesPanel key={label} label={label} />
		</MyErrorBoundary>
	)
}
