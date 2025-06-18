import React from 'react'
import { CAlert } from '@coreui/react'
import type { UserConfigModel } from '@companion-app/shared/Model/UserConfigModel.js'

interface FinishStepProps {
	oldConfig: UserConfigModel
	newConfig: UserConfigModel
}

export function FinishStep({ oldConfig, newConfig }: FinishStepProps): React.JSX.Element {
	return (
		<div>
			<h4>Congratulations!</h4>
			<p style={{ fontWeight: 'bold' }}>
				Companion is now configured and ready for use.
				<br />
				Your next steps are:
			</p>
			<ol>
				<li>
					Review the 'Surfaces' tab and ensure the USB devices you have plugged in are detected for use.{' '}
					{newConfig.elgato_plugin_enable
						? 'Please note that Stream Deck devices will not appear since they are configured for the Stream Deck software.'
						: ''}
				</li>
				<li>Go to the 'Connections' tab to configure the devices you'd like to control.</li>
				<li>
					Go to the 'Buttons' tab to program buttons to control your devices.
					<br />
					<span style={{ fontStyle: 'italic' }}>
						Helpful hint: many devices have 'Presets' (pre-configured buttons) that you can drag and drop onto the
						surfaces.
					</span>
				</li>
			</ol>
			{(newConfig.elgato_plugin_enable && oldConfig.elgato_plugin_enable !== newConfig.elgato_plugin_enable) ||
				(!newConfig.xkeys_enable && oldConfig.xkeys_enable !== newConfig.xkeys_enable) ||
				(!newConfig.loupedeck_enable && oldConfig.loupedeck_enable !== newConfig.loupedeck_enable) ||
				(!newConfig.mirabox_streamdock_enable &&
					oldConfig.mirabox_streamdock_enable !== newConfig.mirabox_streamdock_enable) ||
				(!newConfig.contour_shuttle_enable && oldConfig.contour_shuttle_enable !== newConfig.contour_shuttle_enable) ||
				(!newConfig.vec_footpedal_enable && oldConfig.vec_footpedal_enable !== newConfig.vec_footpedal_enable) ||
				(!newConfig.mystrix_enable && oldConfig.mystrix_enable !== newConfig.mystrix_enable) ||
				(!newConfig.logitech_mx_console_enable &&
					oldConfig.logitech_mx_console_enable !== newConfig.logitech_mx_console_enable && (
						<CAlert color="danger">
							After completing this wizard a restart of Companion is required to apply your USB detection settings. You
							will need to do this manually.
						</CAlert>
					))}
		</div>
	)
}
