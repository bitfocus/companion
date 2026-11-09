import { faSquarePlus } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import './EditButton.css'
import { observer } from 'mobx-react-lite'
import { useContext } from 'react'
import type { BankControlId } from '@companion-app/shared/ControlId.js'
import type { SomeButtonModel } from '@companion-app/shared/Model/ButtonModel.js'
import type { ControlLocation } from '@companion-app/shared/Model/Common.js'
import type { UIControlState } from '@companion-app/shared/Model/Controls.js'
import '~/Layout/PanelEmptyState.css'
import { useControlConfig } from '~/Hooks/useControlConfig.js'
import { MyErrorBoundary } from '~/Resources/Error.js'
import { LoadingRetryOrError } from '~/Resources/Loading.js'
import { assertNever, KeyReceiver } from '~/Resources/util.js'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import { ButtonReferencePanel } from './ButtonReferencePanel.js'
import { CreateButtonTypeButtons } from './CreateButtonTypeButtons.js'
import { LayeredButtonPanel } from './LayeredButtonPanel.js'
import { LinkButtonPanel } from './LinkButtonPanel.js'
import { PageButtonPanel } from './PageButtonPanel.js'
import { PresetReferencePanel } from './PresetReferencePanel.js'

interface EditButtonProps {
	location: ControlLocation
	onKeyUp: (e: React.KeyboardEvent<HTMLDivElement>) => void
	navigateToControl: ((location: ControlLocation) => void) | undefined
}

export const EditButton = observer(function EditButton({ location, onKeyUp, navigateToControl }: EditButtonProps) {
	const { pages } = useContext(RootAppStoreContext)

	const controlId = pages.getControlIdAtLocation(location)

	const { controlConfig, error: configError, reloadConfig } = useControlConfig(controlId)

	const errors: string[] = []
	if (configError) errors.push(configError)
	const loadError = errors.length > 0 ? errors.join(', ') : null
	const dataReady = !loadError && !!controlConfig

	return (
		<KeyReceiver onKeyUp={onKeyUp} tabIndex={0} className="edit-button-panel flex-form">
			{controlId ? (
				<>
					<LoadingRetryOrError dataReady={dataReady} error={loadError} doRetry={reloadConfig} design="pulse" />
					{dataReady && (
						<EditButtonPanel
							controlId={controlId}
							location={location}
							control={controlConfig}
							navigateToControl={navigateToControl}
						/>
					)}
				</>
			) : (
				<div className="panel-empty-state empty-button-state">
					<div className="panel-empty-state-icon">
						<FontAwesomeIcon icon={faSquarePlus} className="non-ideal-svg" />
					</div>
					<h4 className="panel-empty-state-title">Empty button</h4>
					<p className="panel-empty-state-description">Choose a button type to get started.</p>
					<MyErrorBoundary>
						<CreateButtonTypeButtons location={location} />
					</MyErrorBoundary>
				</div>
			)}
		</KeyReceiver>
	)
})

interface EditButtonPanelProps {
	controlId: BankControlId
	location: ControlLocation
	control: UIControlState<SomeButtonModel>
	navigateToControl: ((location: ControlLocation) => void) | undefined
}

function EditButtonPanel({
	controlId,
	location,
	control,
	navigateToControl,
}: EditButtonPanelProps): React.JSX.Element | null {
	switch (control.type) {
		case 'button-layered':
			return (
				<LayeredButtonPanel
					controlId={controlId}
					location={location}
					config={control.config}
					runtimeProps={control.runtime}
				/>
			)
		case 'preset-reference':
			return <PresetReferencePanel controlId={controlId} location={location} config={control.config} />
		case 'button-reference':
			return (
				<ButtonReferencePanel
					controlId={controlId}
					location={location}
					config={control.config}
					navigateToControl={navigateToControl}
				/>
			)
		case 'link-button':
			return (
				<LinkButtonPanel
					controlId={controlId}
					location={location}
					config={control.config}
					runtimeProps={control.runtime}
				/>
			)
		case 'pageup':
		case 'pagedown':
		case 'pagenum':
			return <PageButtonPanel controlId={controlId} location={location} type={control.type} />
		default:
			assertNever(control)
			return null
	}
}
