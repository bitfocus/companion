import { faSync } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { observer } from 'mobx-react-lite'
import { useCallback, useContext } from 'react'
import type { ModuleInstanceType } from '@companion-app/shared/Model/Instance.js'
import { Button } from '~/Components/Button'
import { trpc, useMutationExt } from '~/Resources/TRPC'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'

interface RefreshModulesListProps {
	moduleType: ModuleInstanceType
	moduleId: string
	iconOnly?: boolean
}

export const RefreshModuleInfo = observer(function RefreshModuleInfo({
	moduleType,
	moduleId,
	iconOnly,
}: RefreshModulesListProps) {
	const { modules } = useContext(RootAppStoreContext)

	const { percent: refreshProgress } = modules.getStoreRefreshProgress(moduleType, moduleId)

	const refreshInfoMutation = useMutationExt(trpc.instances.modulesStore.refreshModuleInfo.mutationOptions())

	const doRefreshModules = useCallback(() => {
		refreshInfoMutation.mutateAsync({ moduleType, moduleId }).catch((err) => {
			console.error('Failed to refresh module info', err)
		})
	}, [refreshInfoMutation, moduleType, moduleId])

	if (refreshProgress === 1) {
		return (
			<Button
				color="secondary"
				size="sm"
				onClick={doRefreshModules}
				title="Refresh module info"
				aria-label="Refresh module info"
				variant={iconOnly ? 'ghost' : undefined}
			>
				<FontAwesomeIcon icon={faSync} className={iconOnly ? '' : 'me-1.5'} />
				{!iconOnly && 'Refresh module info'}
			</Button>
		)
	} else {
		return (
			<Button color="secondary" size="sm" disabled aria-busy>
				<FontAwesomeIcon icon={faSync} spin={true} className={iconOnly ? '' : 'me-1.5'} />
				{iconOnly
					? `${Math.round(refreshProgress * 100)}%`
					: `Refreshing module info ${Math.round(refreshProgress * 100)}%`}
			</Button>
		)
	}
})
