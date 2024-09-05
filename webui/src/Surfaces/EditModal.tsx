import React, { useCallback, useContext, useEffect, useImperativeHandle, useState } from 'react'
import {
	CButton,
	CForm,
	CModalBody,
	CModalFooter,
	CModalHeader,
	CFormSelect,
	CCol,
	CFormLabel,
	CFormSwitch,
} from '@coreui/react'
import { LoadingRetryOrError, socketEmitPromise, PreventDefaultHandler, useComputed } from '../util.js'
import { nanoid } from 'nanoid'
import { faQuestionCircle } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { InternalCustomVariableDropdown, InternalPageDropdown } from '../Controls/InternalInstanceFields.js'
import { DropdownInputField, MenuPortalContext } from '../Components/DropdownInputField.js'
import {
	ClientDevicesListItem,
	ClientSurfaceItem,
	CompanionSurfaceConfigField,
	SurfaceGroupConfig,
	SurfacePanelConfig,
} from '@companion-app/shared/Model/Surfaces.js'
import { RootAppStoreContext } from '../Stores/RootAppStore.js'
import { observer } from 'mobx-react-lite'
import { CModalExt } from '../Components/CModalExt.js'
import { NumberInputField } from '../Components/NumberInputField.js'
import { TextInputField } from '../Components/TextInputField.js'
import { InputFeatureIconsProps } from '../Controls/OptionsInputField.js'

export interface SurfaceEditModalRef {
	show(surfaceId: string | null, groupId: string | null): void
}
interface SurfaceEditModalProps {
	// Nothing
}

export const SurfaceEditModal = observer<SurfaceEditModalProps, SurfaceEditModalRef>(
	function SurfaceEditModal(_props, ref) {
		const { surfaces, socket } = useContext(RootAppStoreContext)

		const [rawGroupId, setGroupId] = useState<string | null>(null)
		const [surfaceId, setSurfaceId] = useState<string | null>(null)
		const [show, setShow] = useState(false)

		let surfaceInfo: (ClientSurfaceItem & { groupId: string | null }) | null = null
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

		const [surfaceConfig, setSurfaceConfig] = useState<SurfacePanelConfig | null>(null)
		const [groupConfig, setGroupConfig] = useState<SurfaceGroupConfig | null>(null)
		const [configLoadError, setConfigLoadError] = useState<string | null>(null)
		const [reloadToken, setReloadToken] = useState(nanoid())

		const onClosed = useCallback(() => {
			setSurfaceId(null)
			setSurfaceConfig(null)
			setConfigLoadError(null)
		}, [])

		const doClose = useCallback(() => {
			setShow(false)
		}, [])

		const doRetryConfigLoad = useCallback(() => setReloadToken(nanoid()), [])

		useEffect(() => {
			setConfigLoadError(null)
			setSurfaceConfig(null)
			setGroupConfig(null)

			if (surfaceId) {
				socketEmitPromise(socket, 'surfaces:config-get', [surfaceId])
					.then((config) => {
						setSurfaceConfig(config)
					})
					.catch((err: any) => {
						console.error('Failed to load surface config', err)
						setConfigLoadError(`Failed to load surface config`)
					})
			}
			if (groupId) {
				socketEmitPromise(socket, 'surfaces:group-config-get', [groupId])
					.then((config) => {
						setGroupConfig(config)
					})
					.catch((err: any) => {
						console.error('Failed to load group config', err)
						setConfigLoadError(`Failed to load surface group config`)
					})
			}
		}, [socket, surfaceId, groupId, reloadToken])

		useImperativeHandle(
			ref,
			() => ({
				show(surfaceId, groupId) {
					setSurfaceId(surfaceId)
					setGroupId(groupId)
					setShow(true)
				},
			}),
			[]
		)

		const onlineSurfaceIds = useComputed(() => {
			const onlineSurfaceIds = new Set()
			for (const group of surfaces.store.values()) {
				if (!group) continue
				for (const surface of group.surfaces) {
					if (surface.isConnected) {
						onlineSurfaceIds.add(surface.id)
					}
				}
			}
			return onlineSurfaceIds
		}, [surfaces])

		useEffect(() => {
			// If surface disappears/disconnects, hide this

			setSurfaceId((oldSurfaceId) => {
				if (oldSurfaceId && !onlineSurfaceIds.has(oldSurfaceId)) {
					setShow(false)
				}
				return oldSurfaceId
			})
		}, [onlineSurfaceIds])

		const setSurfaceConfigValue = useCallback(
			(key: string, value: any) => {
				console.log('update surface', key, value)
				if (surfaceId) {
					setSurfaceConfig((oldConfig) => {
						const newConfig: SurfacePanelConfig = {
							...oldConfig,
							[key]: value,
						}

						socketEmitPromise(socket, 'surfaces:config-set', [surfaceId, newConfig])
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
					socketEmitPromise(socket, 'surfaces:group-config-set', [groupId, key, value])
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
				socketEmitPromise(socket, 'surfaces:add-to-group', [groupId, surfaceId]).catch((e) => {
					console.log('Config update failed', e)
				})
			},
			[socket, surfaceId]
		)

		const [modalRef, setModalRef] = useState<HTMLElement | null>(null)

		return (
			<CModalExt ref={setModalRef} visible={show} onClose={doClose} onClosed={onClosed} size="lg">
				<MenuPortalContext.Provider value={modalRef}>
					<CModalHeader closeButton>
						<h5>Settings for {surfaceInfo?.displayName ?? surfaceInfo?.type ?? groupInfo?.displayName}</h5>
					</CModalHeader>
					<CModalBody>
						<LoadingRetryOrError
							error={configLoadError}
							dataReady={(!surfaceId || !!surfaceConfig) && (!groupId || !!groupConfig)}
							doRetry={doRetryConfigLoad}
						/>

						<CForm className="row g-3" onSubmit={PreventDefaultHandler}>
							{surfaceInfo && (
								<>
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

							{groupConfig && (
								<>
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
										<InternalPageDropdown
											label={null}
											disabled={!!groupConfig.use_last_page}
											isLocatedInGrid={false}
											includeDirection={false}
											includeStartup={false}
											value={groupConfig.startup_page}
											setValue={(val) => setGroupConfigValue('startup_page', val)}
										/>
									</CCol>

									<CFormLabel htmlFor="colFormCurrentPage" className="col-sm-4 col-form-label col-form-label-sm">
										Current Page
									</CFormLabel>
									<CCol sm={8}>
										<InternalPageDropdown
											label={null}
											disabled={false}
											isLocatedInGrid={false}
											includeDirection={false}
											includeStartup={false}
											value={groupConfig.last_page}
											setValue={(val) => setGroupConfigValue('last_page', val)}
										/>
									</CCol>
								</>
							)}

							{surfaceConfig && surfaceInfo && (
								<>
									{surfaceInfo.configFields.map((field) => (
										<>
											<CFormLabel className="col-sm-4 col-form-label col-form-label-sm">
												{field.label}
												{field.tooltip && (
													<FontAwesomeIcon
														style={{ marginLeft: '5px' }}
														icon={faQuestionCircle}
														title={field.tooltip}
													/>
												)}
											</CFormLabel>
											<CCol sm={8}>
												<ConfigField
													definition={field}
													value={surfaceConfig[field.id]}
													setValue={setSurfaceConfigValue}
												/>
											</CCol>
										</>
									))}
								</>
							)}
						</CForm>
					</CModalBody>
					<CModalFooter>
						<CButton color="secondary" onClick={doClose}>
							Close
						</CButton>
					</CModalFooter>
				</MenuPortalContext.Provider>
			</CModalExt>
		)
	},
	{ forwardRef: true }
)

interface ConfigFieldProps {
	setValue: (key: string, value: any) => void
	definition: CompanionSurfaceConfigField
	value: any
}

function ConfigField({ setValue, definition, value }: ConfigFieldProps) {
	const id = definition.id
	const setValue2 = useCallback((val: any) => setValue(id, val), [setValue, id])

	const fieldType = definition.type
	switch (definition.type) {
		case 'textinput': {
			const features: InputFeatureIconsProps = {
				variables: !!definition.useVariables,
				local: typeof definition.useVariables === 'object' && !!definition.useVariables?.local,
			}

			return (
				<TextInputField
					// label={<OptionLabel option={option} features={features} />}
					value={value}
					regex={definition.regex}
					placeholder={definition.placeholder}
					useVariables={features.variables}
					useLocalVariables={features.local}
					isExpression={definition.isExpression}
					setValue={setValue2}
				/>
			)
		}
		case 'number':
			return (
				<NumberInputField
					required={definition.required}
					min={definition.min}
					max={definition.max}
					step={definition.step}
					range={definition.range}
					value={value}
					setValue={setValue2}
				/>
			)
		case 'checkbox':
			return (
				<div style={{ marginRight: 40, marginTop: 2 }}>
					<CFormSwitch
						color="success"
						checked={value}
						size="xl"
						title={definition.tooltip} // nocommit: this needs fixing
						onChange={() => {
							setValue2(!value)
							//setValid2(true)
						}}
					/>
				</div>
			)
		case 'dropdown':
			return (
				<DropdownInputField
					choices={definition.choices}
					allowCustom={definition.allowCustom}
					minChoicesForSearch={definition.minChoicesForSearch}
					regex={definition.regex}
					value={value}
					setValue={setValue2}
					multiple={false}
				/>
			)
		case 'custom-variable':
			return <InternalCustomVariableDropdown value={value} setValue={setValue2} includeNone={true} />
			break
		default:
			return <p>Unknown field "{fieldType}"</p>
	}
}
