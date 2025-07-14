import React, { useCallback, useContext, useEffect, useState } from 'react'
import { CForm, CFormSelect, CCol, CFormLabel, CFormSwitch } from '@coreui/react'
import { LoadingRetryOrError, PreventDefaultHandler } from '~/util.js'
import { nanoid } from 'nanoid'
import { faQuestionCircle } from '@fortawesome/free-solid-svg-icons'
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

const SurfaceEditPanelContent = observer<SurfaceEditPanelOldProps>(function SurfaceEditPanelContent({
	surfaceInfo,
	groupInfo,
}) {
	const { surfaces, socket } = useContext(RootAppStoreContext)

	const surfaceId = surfaceInfo?.id ?? null
	const groupId = groupInfo?.id ?? null

	const [surfaceConfig, setSurfaceConfig] = useState<SurfacePanelConfig | null>(null)
	const [groupConfig, setGroupConfig] = useState<SurfaceGroupConfig | null | false>(null)
	const [configLoadError, setConfigLoadError] = useState<string | null>(null)
	const [reloadToken, setReloadToken] = useState(nanoid())

	const doRetryConfigLoad = useCallback(() => setReloadToken(nanoid()), [])

	useEffect(() => {
		setConfigLoadError(null)
		setSurfaceConfig(null)
		setGroupConfig(null)

		if (surfaceId) {
			socket
				.emitPromise('surfaces:config-get', [surfaceId])
				.then((config) => {
					setSurfaceConfig(config)
				})
				.catch((err: any) => {
					console.error('Failed to load surface config', err)
					setConfigLoadError(`Failed to load surface config`)
				})
		}
		if (groupId) {
			socket
				.emitPromise('surfaces:group-config-get', [groupId])
				.then((config) => {
					setGroupConfig(config)
				})
				.catch((err: any) => {
					setGroupConfig(false)
					console.error('Failed to load group config', err)
					setConfigLoadError(`Failed to load surface group config`)
				})
		}
	}, [socket, surfaceId, groupId, reloadToken])

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

	const setSurfaceConfigValue = useCallback(
		(key: string, value: any) => {
			console.log('update surface', key, value)
			if (surfaceId) {
				setSurfaceConfig((oldConfig) => {
					if (!oldConfig) return oldConfig

					const newConfig: SurfacePanelConfig = {
						...oldConfig,
						[key]: value,
					}

					socket
						.emitPromise('surfaces:config-set', [surfaceId, newConfig])
						.then((newConfig) => {
							if (typeof newConfig === 'string') {
								console.log('Config update failed', newConfig)
							} else {
								setSurfaceConfig(newConfig)
							}
						})
						.catch((e) => {
							console.log('Config update failed', e)
						})
					return newConfig
				})
			}
		},
		[socket, surfaceId]
	)

	const setGroupConfigValue = useCallback(
		(key: string, value: any) => {
			console.log('update group', key, value)
			if (groupId) {
				socket
					.emitPromise('surfaces:group-config-set', [groupId, key, value])
					.then((newConfig) => {
						if (typeof newConfig === 'string') {
							console.log('group config update failed', newConfig)
						} else {
							setGroupConfig(newConfig)
						}
					})
					.catch((e) => {
						console.log('group config update failed', e)
					})

				setGroupConfig((oldConfig) => {
					if (!oldConfig) return oldConfig
					return {
						...oldConfig,
						[key]: value,
					}
				})
			}
		},
		[socket, groupId]
	)

	const setSurfaceGroupId = useCallback(
		(groupId0: string) => {
			if (!surfaceId) return
			const groupId = !groupId0 || groupId0 === 'null' ? null : groupId0
			socket.emitPromise('surfaces:add-to-group', [groupId, surfaceId]).catch((e) => {
				console.log('Config update failed', e)
			})
		},
		[socket, surfaceId]
	)

	const updateName = useCallback(
		(itemId: string, name: string) => {
			socket.emitPromise('surfaces:set-name', [itemId, name]).catch((err) => {
				console.error('Update name failed', err)
			})
		},
		[socket]
	)

	// Show loading or error state
	const dataReady = (!surfaceId || !!surfaceConfig) && (!groupId || groupConfig !== null)
	if (!dataReady || configLoadError) {
		return (
			<>
				<LoadingRetryOrError error={configLoadError} dataReady={dataReady} doRetry={doRetryConfigLoad} design="pulse" />
			</>
		)
	}

	return (
		<>
			<CForm className="row g-3" onSubmit={PreventDefaultHandler}>
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
							<FontAwesomeIcon
								icon={faQuestionCircle}
								title="When in a group, surfaces will follow the page number of that group"
							/>
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

				{groupConfig && groupInfo && (
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
								checked={!!groupConfig.use_last_page}
								onChange={(e) => setGroupConfigValue('use_last_page', !!e.currentTarget.checked)}
							/>
						</CCol>

						<CFormLabel htmlFor="colFormStartupPage" className="col-sm-4 col-form-label col-form-label-sm">
							Startup Page
						</CFormLabel>
						<CCol sm={8}>
							<InternalPageIdDropdown
								disabled={!!groupConfig.use_last_page}
								includeDirection={false}
								includeStartup={false}
								value={groupConfig.startup_page_id}
								setValue={(val) => setGroupConfigValue('startup_page_id', val)}
							/>
						</CCol>

						<CFormLabel htmlFor="colFormCurrentPage" className="col-sm-4 col-form-label col-form-label-sm">
							Current Page
						</CFormLabel>
						<CCol sm={8}>
							<InternalPageIdDropdown
								disabled={false}
								includeDirection={false}
								includeStartup={false}
								value={groupConfig.last_page_id}
								setValue={(val) => setGroupConfigValue('last_page_id', val)}
							/>
						</CCol>
					</>
				)}

				{surfaceConfig &&
					surfaceInfo &&
					surfaceInfo.configFields.map((field) => (
						<EditPanelConfigField
							key={field.id}
							definition={field}
							value={surfaceConfig[field.id]}
							setValue={setSurfaceConfigValue}
						/>
					))}

				{surfaceConfig && surfaceInfo && !surfaceInfo.isConnected && (
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
