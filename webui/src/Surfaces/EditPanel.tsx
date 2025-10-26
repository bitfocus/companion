import React, { useCallback, useContext, useEffect, useState } from 'react'
import { CForm, CFormSelect, CCol, CFormLabel, CFormSwitch } from '@coreui/react'
import { PreventDefaultHandler } from '~/Resources/util.js'
import { LoadingRetryOrError } from '~/Resources/Loading.js'
import { faQuestionCircle, faTimes } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { InternalPageIdDropdown } from '~/Controls/InternalModuleField.js'
import {
	ClientDevicesListItem,
	ClientSurfaceItem,
	SurfaceGroupConfig,
	SurfacePanelConfig,
} from '@companion-app/shared/Model/Surfaces.js'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import { observer } from 'mobx-react-lite'
import { TextInputField } from '~/Components/TextInputField.js'
import { EditPanelConfigField } from './EditPanelConfigField'
import { NonIdealState } from '~/Components/NonIdealState'
import { trpc, useMutationExt } from '~/Resources/TRPC'
import { useSubscription } from '@trpc/tanstack-react-query'
import { useNavigate } from '@tanstack/react-router'
import { InlineHelp } from '~/Components/InlineHelp'

type SurfaceInfo = ClientSurfaceItem & { groupId: string | null }

interface SurfaceEditPanelProps {
	surfaceId: string | null
	groupId: string | null
}

export const SurfaceEditPanel = observer<SurfaceEditPanelProps>(function SurfaceEditPanel({
	surfaceId,
	groupId: rawGroupId,
}) {
	const { surfaces } = useContext(RootAppStoreContext)
	const navigate = useNavigate()

	const doCloseSurface = useCallback(() => {
		void navigate({ to: '/surfaces/configured' })
	}, [navigate])

	let surfaceInfo: SurfaceInfo | null = null
	if (surfaceId) {
		for (const group of surfaces.store.values()) {
			if (surfaceInfo || !group) break

			for (const surface of group.surfaces) {
				if (surface.id === surfaceId) {
					surfaceInfo = {
						...surface,
						groupId: group.isAutoGroup ? null : group.id,
					}
					break
				}
			}
		}
	}

	const groupId = surfaceInfo && !surfaceInfo.groupId ? surfaceId : rawGroupId
	let groupInfo = null
	if (groupId) {
		for (const group of surfaces.store.values()) {
			if (group && group.id === groupId) {
				groupInfo = group
				break
			}
		}
	}

	return (
		<>
			<div className="secondary-panel-simple-header">
				<h4 className="panel-title">
					Settings for {surfaceInfo?.displayName ?? surfaceInfo?.type ?? groupInfo?.displayName}
				</h4>
				<div className="header-buttons">
					<div className="float_right d-xl-none" onClick={doCloseSurface} title="Close">
						<FontAwesomeIcon icon={faTimes} size="lg" />
					</div>
				</div>
			</div>

			<div className="secondary-panel-simple-body">
				<SurfaceEditPanelContent surfaceInfo={surfaceInfo} groupInfo={groupInfo} />
			</div>
		</>
	)
})

interface SurfaceEditPanelOldProps {
	surfaceInfo: SurfaceInfo | null
	groupInfo: ClientDevicesListItem | null
}

function useSurfaceConfig(surfaceId: string | null) {
	const [surfaceConfig, setSurfaceConfig] = useState<SurfacePanelConfig | null>(null)
	const [configLoadError, setConfigLoadError] = useState<string | null>(null)

	const configSub = useSubscription(
		trpc.surfaces.watchSurfaceConfig.subscriptionOptions(
			{
				surfaceId: surfaceId ?? '',
			},
			{
				enabled: !!surfaceId,
				onStarted: () => {
					setConfigLoadError(null)
					setSurfaceConfig(null)
				},
				onData: (data) => {
					setSurfaceConfig(data)
				},
				onError: (err) => {
					console.error('Failed to load surface config', err)
				},
			}
		)
	)

	useEffect(() => setSurfaceConfig(null), [surfaceId])

	return {
		reset: configSub.reset,
		error: configLoadError,
		config: surfaceConfig,
	}
}
function useGroupConfig(groupId: string | null) {
	const [groupConfig, setGroupConfig] = useState<SurfaceGroupConfig | null>(null)
	const [configLoadError, setConfigLoadError] = useState<string | null>(null)

	const configSub = useSubscription(
		trpc.surfaces.watchGroupConfig.subscriptionOptions(
			{
				groupId: groupId ?? '',
			},
			{
				enabled: !!groupId,
				onStarted: () => {
					setConfigLoadError(null)
					setGroupConfig(null)
				},
				onData: (data) => {
					setGroupConfig(data)
				},
				onError: (err) => {
					console.error('Failed to load group config', err)
					setConfigLoadError(`Failed to load group config: ${err.message}`)
				},
			}
		)
	)

	useEffect(() => setGroupConfig(null), [groupId])

	return {
		reset: configSub.reset,
		error: configLoadError,
		config: groupConfig,
	}
}

const SurfaceEditPanelContent = observer<SurfaceEditPanelOldProps>(function SurfaceEditPanelContent({
	surfaceInfo,
	groupInfo,
}) {
	const { surfaces } = useContext(RootAppStoreContext)

	const surfaceId = surfaceInfo?.id ?? null
	const groupId = groupInfo?.id ?? null

	const surfaceConfig = useSurfaceConfig(surfaceId)
	const groupConfig = useGroupConfig(groupId)

	const surfaceConfigReset = surfaceConfig.reset
	const groupConfigReset = groupConfig.reset
	const doRetryConfigLoad = useCallback(() => {
		surfaceConfigReset()
		groupConfigReset()
	}, [surfaceConfigReset, groupConfigReset])

	// Remove unused onlineSurfaceIds for now - could be used for validation later
	// const onlineSurfaceIds = useComputed(() => {
	// 	const onlineSurfaceIds = new Set()
	// 	for (const group of surfaces.store.values()) {
	// 		if (!group) continue
	// 		for (const surface of group.surfaces) {
	// 			if (surface.isConnected) {
	// 				onlineSurfaceIds.add(surface.id)
	// 			}
	// 		}
	// 	}
	// 	return onlineSurfaceIds
	// }, [surfaces])

	const surfaceSetConfigKeyMutation = useMutationExt(trpc.surfaces.surfaceSetConfigKey.mutationOptions())
	const setSurfaceConfigValue = useCallback(
		(key: string, value: any) => {
			console.log('update surface', key, value)
			if (surfaceId) {
				surfaceSetConfigKeyMutation
					.mutateAsync({
						surfaceId,
						key,
						value,
					})
					.then((error) => {
						if (error) {
							console.log('Config update failed', error)
						}
					})
					.catch((e) => {
						console.log('Config update failed', e)
					})
			}
		},
		[surfaceSetConfigKeyMutation, surfaceId]
	)

	const setGroupConfigKeyMutation = useMutationExt(trpc.surfaces.groupSetConfigKey.mutationOptions())
	const setGroupConfigValue = useCallback(
		(key: string, value: any) => {
			console.log('update group', key, value)
			if (groupId) {
				setGroupConfigKeyMutation
					.mutateAsync({
						groupId,
						key,
						value,
					})
					.then((error) => {
						if (error) {
							console.log('group config update failed', error)
						}
					})
					.catch((e) => {
						console.log('group config update failed', e)
					})
			}
		},
		[setGroupConfigKeyMutation, groupId]
	)

	const surfaceSetGroupMutation = useMutationExt(trpc.surfaces.surfaceSetGroup.mutationOptions())
	const setSurfaceGroupId = useCallback(
		(groupId0: string) => {
			if (!surfaceId) return
			const groupId = !groupId0 || groupId0 === 'null' ? null : groupId0
			surfaceSetGroupMutation.mutateAsync({ groupId, surfaceId }).catch((e) => {
				console.log('Config update failed', e)
			})
		},
		[surfaceSetGroupMutation, surfaceId]
	)

	const setNameMutation = useMutationExt(trpc.surfaces.surfaceOrGroupSetName.mutationOptions())
	const updateName = useCallback(
		(surfaceOrGroupId: string, name: string) => {
			setNameMutation.mutateAsync({ surfaceOrGroupId, name }).catch((err) => {
				console.error('Update name failed', err)
			})
		},
		[setNameMutation]
	)

	// Show loading or error state
	const dataReady = (!surfaceId || !!surfaceConfig.config) && (!groupId || groupConfig.config !== null)
	if (!dataReady || surfaceConfig.error || groupConfig.error) {
		return (
			<>
				<LoadingRetryOrError
					error={surfaceConfig.error || groupConfig.error}
					dataReady={dataReady}
					doRetry={doRetryConfigLoad}
					design="pulse"
				/>
			</>
		)
	}

	return (
		<>
			<CForm className="row g-sm-2" onSubmit={PreventDefaultHandler}>
				{surfaceInfo && (
					<>
						<CFormLabel htmlFor="colFormSurfaceName" className="col-sm-4 col-form-label col-form-label-sm">
							Surface Name
						</CFormLabel>
						<CCol sm={8}>
							<TextInputField value={surfaceInfo.name} setValue={(name) => updateName(surfaceInfo.id, name)} />
						</CCol>

						<CFormLabel htmlFor="colFormGroupId" className="col-sm-4 col-form-label col-form-label-sm">
							Surface Group&nbsp;
							<InlineHelp help="When in a group, surfaces will follow the page number of that group">
								<FontAwesomeIcon icon={faQuestionCircle} />
							</InlineHelp>
						</CFormLabel>
						<CCol sm={8}>
							<CFormSelect
								name="colFormGroupId"
								value={surfaceInfo.groupId || 'null'}
								onChange={(e) => setSurfaceGroupId(e.currentTarget.value)}
							>
								<option value="null">Standalone (Default)</option>

								{Array.from(surfaces.store.values())
									.filter((group): group is ClientDevicesListItem => !!group && !group.isAutoGroup)
									.map((group) => (
										<option key={group.id} value={group.id}>
											{group.displayName}
										</option>
									))}
							</CFormSelect>
						</CCol>
					</>
				)}

				{groupConfig.config && groupInfo && (
					<>
						{!groupInfo.isAutoGroup && (
							<>
								<CFormLabel htmlFor="colFormGroupName" className="col-sm-4 col-form-label col-form-label-sm">
									Group Name
								</CFormLabel>
								<CCol sm={8}>
									<TextInputField value={groupInfo.displayName} setValue={(name) => updateName(groupInfo.id, name)} />
								</CCol>
							</>
						)}

						<CFormLabel htmlFor="colFormUseLastPage" className="col-sm-4 col-form-label col-form-label-sm">
							Use Last Page At Startup
						</CFormLabel>
						<CCol sm={8}>
							<CFormSwitch
								name="colFormUseLastPage"
								className="mx-2"
								size="xl"
								checked={!!groupConfig.config.use_last_page}
								onChange={(e) => setGroupConfigValue('use_last_page', !!e.currentTarget.checked)}
							/>
						</CCol>

						<CFormLabel htmlFor="colFormStartupPage" className="col-sm-4 col-form-label col-form-label-sm">
							{groupConfig.config.use_last_page ? 'Home Page' : 'Startup Page'}
						</CFormLabel>
						<CCol sm={8}>
							<InternalPageIdDropdown
								disabled={false}
								includeDirection={false}
								includeStartup={false}
								value={groupConfig.config.startup_page_id}
								setValue={(val) => setGroupConfigValue('startup_page_id', val)}
							/>
						</CCol>

						{(surfaceInfo === null || !!surfaceInfo.isConnected || !!groupConfig.config.use_last_page) && (
							<>
								<CFormLabel htmlFor="colFormCurrentPage" className="col-sm-4 col-form-label col-form-label-sm">
									{surfaceInfo === null || surfaceInfo?.isConnected ? 'Current Page' : 'Last Page'}
								</CFormLabel>
								<CCol sm={8}>
									<InternalPageIdDropdown
										disabled={false}
										includeDirection={false}
										includeStartup={false}
										value={groupConfig.config.last_page_id}
										setValue={(val) => setGroupConfigValue('last_page_id', val)}
									/>
								</CCol>
							</>
						)}

						<CFormLabel htmlFor="colFormRestrictPages" className="col-sm-4 col-form-label col-form-label-sm">
							Restrict pages accessible to this {surfaceId === null ? 'group' : 'surface'}
						</CFormLabel>
						<CCol sm={8}>
							<CFormSwitch
								name="colFormRestrictPages"
								className="mx-2"
								size="xl"
								checked={!!groupConfig.config.restrict_pages}
								onChange={(e) => setGroupConfigValue('restrict_pages', !!e.currentTarget.checked)}
							/>
						</CCol>

						{!!groupConfig.config.restrict_pages && (
							<>
								<CFormLabel htmlFor="colFormAllowedPages" className="col-sm-4 col-form-label col-form-label-sm">
									Allowed pages:
								</CFormLabel>
								<CCol sm={8}>
									<InternalPageIdDropdown
										disabled={false}
										includeDirection={false}
										includeStartup={false}
										multiple={true}
										value={groupConfig.config.allowed_page_ids}
										setValue={(val) => setGroupConfigValue('allowed_page_ids', val)}
									/>
								</CCol>
							</>
						)}
					</>
				)}

				{surfaceConfig.config &&
					surfaceInfo &&
					surfaceInfo.configFields.map((field) => (
						<EditPanelConfigField
							key={field.id}
							definition={field}
							value={surfaceConfig.config?.[field.id]}
							setValue={setSurfaceConfigValue}
						/>
					))}

				{surfaceConfig.config && surfaceInfo && !surfaceInfo.isConnected && (
					<CCol sm={12}>
						<NonIdealState
							icon={faQuestionCircle}
							text="This surface is currently offline. Some settings are not available."
						/>
					</CCol>
				)}
			</CForm>
		</>
	)
})
