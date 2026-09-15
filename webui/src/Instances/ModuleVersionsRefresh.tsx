import { faCheck, faSync, faXmark } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { observer } from 'mobx-react-lite'
import { useCallback, useContext, useEffect, useRef, useState } from 'react'
import type { ModuleInstanceType } from '@companion-app/shared/Model/Instance.js'
import { trpc, useMutationExt } from '~/Resources/TRPC'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'

interface ModuleVersionsRefreshProps {
	moduleType: ModuleInstanceType
	moduleId: string | null
}
export const ModuleVersionsRefresh = observer(function ModuleVersionsRefresh({
	moduleType,
	moduleId,
}: ModuleVersionsRefreshProps) {
	const { modules } = useContext(RootAppStoreContext)

	const { percent: refreshProgress, failed } = moduleId
		? modules.getStoreRefreshProgress(moduleType, moduleId)
		: { percent: 1, failed: false }
	const isRefreshing = refreshProgress !== 1

	const refreshInfoMutation = useMutationExt(trpc.instances.modulesStore.refreshModuleInfo.mutationOptions())
	const doRefreshModules = useCallback(() => {
		if (!moduleId) return
		refreshInfoMutation.mutateAsync({ moduleType, moduleId }).catch((err) => {
			console.error('Failed to refresh module versions', err)
		})
	}, [refreshInfoMutation, moduleType, moduleId])

	// Briefly show the outcome (tick or cross) once a refresh finishes, so a fast refresh still gives
	// visible feedback and a failure is not silent
	const [completed, setCompleted] = useState<'success' | 'failed' | null>(null)
	const wasRefreshing = useRef(false)
	useEffect(() => {
		if (isRefreshing) {
			wasRefreshing.current = true
			setCompleted(null)
			return undefined
		} else if (wasRefreshing.current) {
			wasRefreshing.current = false
			setCompleted(failed ? 'failed' : 'success')
			const timeout = setTimeout(() => setCompleted(null), 2000)
			return () => clearTimeout(timeout)
		} else {
			return undefined
		}
	}, [isRefreshing, failed])

	if (isRefreshing) {
		return (
			<button
				type="button"
				disabled
				className="w-6 h-6 inline-flex items-center justify-center rounded-lg text-muted transition-colors border-0 bg-transparent"
				title={`Refreshing module info ${Math.round(refreshProgress * 100)}%`}
				aria-label={`Refreshing module info ${Math.round(refreshProgress * 100)}%`}
			>
				<FontAwesomeIcon icon={faSync} spin={true} className="text-xs" />
			</button>
		)
	}

	if (completed === 'success') {
		return (
			<div className="float_right text-success" title="Module versions refreshed">
				<FontAwesomeIcon icon={faCheck} aria-label="Module versions refreshed" />
			</div>
		)
	}

	if (completed === 'failed') {
		return (
			<div className="float_right text-danger" title="Failed to refresh module versions">
				<FontAwesomeIcon icon={faXmark} aria-label="Failed to refresh module versions" />
			</div>
		)
	}

	return (
		<button
			type="button"
			className="panel-icon-button panel-icon-button-sm"
			onClick={doRefreshModules}
			onKeyDown={(e) => {
				if (e.key === 'Enter' || e.key === ' ') {
					e.preventDefault()
					doRefreshModules()
				}
			}}
			title="Refresh module versions"
			aria-label="Refresh module versions"
		>
			<FontAwesomeIcon icon={faSync} className="text-xs" />
		</button>
	)
})
