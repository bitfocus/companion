import { useSubscription } from '@trpc/tanstack-react-query'
import { runInAction, type IObservableValue } from 'mobx'
import type { ImportExportTask } from '@companion-app/shared/Model/ImportExport.js'
import { trpc } from '~/Resources/TRPC'

/**
 * Drive the shared import/reset task status from a single subscription. Both the "config is being
 * updated" overlay and the full-import flow read the resulting observable, so there is one stream and
 * one source of truth for the task status.
 */
export function useImportTaskStatusSubscription(status: IObservableValue<ImportExportTask | null>): void {
	useSubscription(
		trpc.importExport.importExportTaskStatus.subscriptionOptions(undefined, {
			onData: (data) => {
				runInAction(() => status.set(data))
			},
			onError: (error) => {
				console.error('Error in importExportTaskStatus subscription:', error)
				runInAction(() => status.set(null))
			},
		})
	)
}
