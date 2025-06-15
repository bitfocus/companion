import React from 'react'
import { Link, RegisteredRouter, ToPathOption } from '@tanstack/react-router'
import { CCard, CCol, CRow } from '@coreui/react'
import { faCog, faGamepad, faNetworkWired, faTh, faWarning } from '@fortawesome/free-solid-svg-icons'
import { NonIdealState } from '~/Components/NonIdealState.js'
import { IconProp } from '@fortawesome/fontawesome-svg-core'

export function SettingsSelectPage(): React.JSX.Element {
	return (
		<CRow className="split-panels">
			<CCol xl={6} className="primary-panel">
				<div className="d-flex justify-content-between">
					<div>
						<h4>Settings</h4>
					</div>
				</div>
				<div className="h-fit-content">
					<CRow>
						<SettingsLinkCard label="General" to="/settings/general" icon={faCog} />
						<SettingsLinkCard label="Buttons" to="/settings/buttons" icon={faTh} />
						<SettingsLinkCard label="Surfaces" to="/settings/surfaces" icon={faGamepad} />
						<SettingsLinkCard label="Protocols" to="/settings/protocols" icon={faNetworkWired} />
						<SettingsLinkCard label="Advanced" to="/settings/advanced" icon={faWarning} center />
					</CRow>
				</div>
			</CCol>
		</CRow>
	)
}

interface SettingsLinkCardProps<TFrom extends string = string, TTo extends string | undefined = undefined> {
	label: string
	to: ToPathOption<RegisteredRouter, TFrom, TTo>
	icon: IconProp
	center?: boolean
}

function SettingsLinkCard<const TFrom extends string = string, const TTo extends string | undefined = undefined>({
	label,
	to,
	icon,
	center,
}: SettingsLinkCardProps<TFrom, TTo>) {
	return (
		<CCol sm={center ? { span: 6, offset: 3 } : 6} className="mb-4">
			<Link to={to} className="text-decoration-none">
				<CCard>
					<NonIdealState icon={icon} style={{ padding: '5vh 1rem' }}>
						<h3>{label}</h3>
					</NonIdealState>
				</CCard>
			</Link>
		</CCol>
	)
}
