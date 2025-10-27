import React, { useCallback } from 'react'
import { CForm, CCol, CFormLabel, CFormText } from '@coreui/react'
import { PreventDefaultHandler } from '~/Resources/util.js'
import { faTimes } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import type { OutboundSurfaceInfo } from '@companion-app/shared/Model/Surfaces.js'
import { observer } from 'mobx-react-lite'
import { TextInputField } from '~/Components/TextInputField.js'
import { trpc, useMutationExt } from '~/Resources/TRPC'
import { useNavigate } from '@tanstack/react-router'

interface SurfaceEditPanelProps {
	remoteInfo: OutboundSurfaceInfo
}

export const RemoteSurfaceEditPanel = observer<SurfaceEditPanelProps>(function RemoteSurfaceEditPanel({ remoteInfo }) {
	const navigate = useNavigate()

	const doCloseSurface = useCallback(() => {
		void navigate({ to: '/surfaces/remote' })
	}, [navigate])

	return (
		<>
			<div className="secondary-panel-simple-header">
				<h4 className="panel-title">Settings for {remoteInfo?.displayName}</h4>
				<div className="header-buttons">
					<div className="float_right d-xl-none" onClick={doCloseSurface} title="Close">
						<FontAwesomeIcon icon={faTimes} size="lg" />
					</div>
				</div>
			</div>

			<div className="secondary-panel-simple-body">
				<SurfaceEditPanelContent remoteInfo={remoteInfo} />
			</div>
		</>
	)
})

interface SurfaceEditPanelContentProps {
	remoteInfo: OutboundSurfaceInfo
}

const SurfaceEditPanelContent = observer<SurfaceEditPanelContentProps>(function SurfaceEditPanelContent({
	remoteInfo,
}) {
	const setNameMutation = useMutationExt(trpc.surfaces.outbound.setName.mutationOptions())
	const updateName = useCallback(
		(name: string) => {
			setNameMutation.mutateAsync({ id: remoteInfo.id, name }).catch((err) => {
				console.error('Update name failed', err)
			})
		},
		[setNameMutation, remoteInfo]
	)

	return (
		<>
			<CForm className="row g-sm-2" onSubmit={PreventDefaultHandler}>
				<CFormLabel htmlFor="colFormName" className="col-sm-4 col-form-label col-form-label-sm">
					Name
				</CFormLabel>
				<CCol sm={8}>
					<TextInputField value={remoteInfo.displayName} setValue={updateName} />
				</CCol>

				<CFormLabel htmlFor="colFormType" className="col-sm-4 col-form-label col-form-label-sm">
					Type
				</CFormLabel>
				<CCol sm={8}>
					<CFormText>IP Stream Deck</CFormText>
				</CCol>

				<CFormLabel htmlFor="colFormAddress" className="col-sm-4 col-form-label col-form-label-sm">
					Address
				</CFormLabel>
				<CCol sm={8}>
					<CFormText>{remoteInfo.address}</CFormText>
				</CCol>

				<CFormLabel htmlFor="colFormPort" className="col-sm-4 col-form-label col-form-label-sm">
					Port
				</CFormLabel>
				<CCol sm={8}>
					<CFormText>{remoteInfo.port}</CFormText>
				</CCol>
			</CForm>
		</>
	)
})
