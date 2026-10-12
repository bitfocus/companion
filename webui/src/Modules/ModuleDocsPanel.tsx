import { useQuery } from '@tanstack/react-query'
import { ModuleHelpContent, resolveModuleHelpUrl } from '~/Instances/ModuleHelpContent.js'

export function ModuleDocsPanel({ helpPath }: { helpPath: string | null | undefined }): React.JSX.Element {
	const helpUrl = helpPath ? resolveModuleHelpUrl(helpPath) : undefined
	const {
		data: markdown,
		isLoading,
		error,
	} = useQuery({
		queryKey: ['module-help', helpUrl],
		enabled: !!helpUrl,
		queryFn: async () => {
			const response = await fetch(helpUrl!)
			if (!response.ok) throw new Error(`HTTP ${response.status}`)
			return response.text()
		},
		staleTime: Infinity,
	})

	if (!helpUrl) return <p className="text-sm text-muted">No documentation available for this version.</p>
	if (isLoading) return <p className="text-sm text-muted">Loading documentation…</p>
	if (error) return <p className="text-sm text-tone-error-text">Failed to load documentation: {error.message}</p>
	if (!markdown) return <p className="text-sm text-muted">No documentation available.</p>
	return <ModuleHelpContent markdown={markdown} helpUrl={helpUrl} />
}
