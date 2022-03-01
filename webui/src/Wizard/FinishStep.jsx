import React from 'react'
import { CAlert } from '@coreui/react'

export function FinishStep({ oldConfig, newConfig }) {
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
				<li>Go to the 'Conections' tab to configure the devices you'd like to control.</li>
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
			(!newConfig.xkeys_enable && oldConfig.xkeys_enable !== newConfig.xkeys_enable) ? (
				<CAlert color="danger">
					After completing this wizard a restart of Companion is required to apply your USB detection settings. You will
					need to do this manually.
				</CAlert>
			) : (
				''
			)}
		</div>
	)
}
