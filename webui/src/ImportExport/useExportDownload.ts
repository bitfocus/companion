import { useCallback } from 'react'
import type { ClientExportRequest } from '@companion-app/shared/Model/ImportExport.js'
import { trpc, useMutationExt } from '~/Resources/TRPC.js'
import { makeAbsolutePath } from '~/Resources/util.js'

/**
 * Prepare an export on the server, then download it from this page, so no tab is opened for it.
 * Rejects if the server refuses the request.
 */
export function useExportDownload(): (request: ClientExportRequest) => Promise<void> {
	const prepareExportMutation = useMutationExt(trpc.importExport.prepareExport.mutationOptions())

	return useCallback(
		async (request: ClientExportRequest) => {
			const token = await prepareExportMutation.mutateAsync(request)

			// The server's Content-Disposition decides the real filename
			const link = document.createElement('a')
			link.setAttribute('download', 'export.companionconfig')
			link.href = makeAbsolutePath(`/int/export/download/${encodeURIComponent(token)}`)
			document.body.appendChild(link)
			link.click()
			link.remove()
		},
		[prepareExportMutation]
	)
}
