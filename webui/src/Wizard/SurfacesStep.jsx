import React from 'react'
import { CInputCheckbox, CInputRadio, CLabel } from '@coreui/react'

export function SurfacesStep({ config, setValue }) {
	return (
		<div>
			<h5>USB Surface Detection Configuration</h5>
			<p className="indent3">Stream Deck USB Hardware</p>
			<div className="indent3">
				<div className="form-check form-check-inline mr-1">
					<CInputRadio
						id="userconfig_elgato_plugin_disable"
						checked={!config.elgato_plugin_enable}
						onChange={(e) => setValue('elgato_plugin_enable', false)}
					/>
					<CLabel htmlFor="userconfig_elgato_plugin_disable">
						Use Companion natively (requires Stream Deck software to be closed)
					</CLabel>
				</div>
			</div>
			<div className="indent3">
				<div className="form-check form-check-inline mr-1">
					<CInputRadio
						id="userconfig_elgato_plugin_enable"
						checked={config.elgato_plugin_enable}
						onChange={(e) => setValue('elgato_plugin_enable', true)}
					/>
					<CLabel htmlFor="userconfig_elgato_plugin_enable">Use Stream Deck software via Companion plugin</CLabel>
				</div>
			</div>

			<p className="indent3">X-keys USB Keypads</p>
			<div className="indent3">
				<div className="form-check form-check-inline mr-1">
					<CInputCheckbox
						id="userconfig_xkeys_enable"
						checked={config.xkeys_enable}
						onChange={(e) => setValue('xkeys_enable', e.currentTarget.checked)}
					/>
					<CLabel htmlFor="userconfig_xkeys_enable">Enable</CLabel>
				</div>
			</div>

			<p className="indent3">Loupedeck USB Devices</p>
			<div className="indent3">
				<div className="form-check form-check-inline mr-1">
					<CInputCheckbox
						id="userconfig_loupedeck_enable"
						checked={config.loupedeck_enable}
						onChange={(e) => setValue('loupedeck_enable', e.currentTarget.checked)}
					/>
					<CLabel htmlFor="userconfig_loupedeck_enable">Enable</CLabel>
				</div>
			</div>
		</div>
	)
}
