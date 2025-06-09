import React from 'react'
import { CFormInput, CFormCheck } from '@coreui/react'
import type { UserConfigModel } from '@companion-app/shared/Model/UserConfigModel.js'

interface ServicesStepProps {
	config: Partial<UserConfigModel>
	setValue: (key: keyof UserConfigModel, value: any) => void
}

export function ServicesStep({ config, setValue }: ServicesStepProps): React.JSX.Element {
	return (
		<div>
			<h5>Remote Control Services</h5>
			<p>
				In addition to USB hardware, Companion is able to be controlled over the network by various different methods.
				Since these expose Companion to control via your network, it is only recommended to enable the services you
				need.
			</p>
			<div className="indent3">
				<CFormCheck
					label="TCP Raw Socket"
					checked={config.tcp_enabled}
					onChange={(e) => setValue('tcp_enabled', e.currentTarget.checked)}
				/>
				{config.tcp_enabled && (
					<div className="indent2, group">
						<div className="col-left">Listen Port</div>
						<div className="col-right">
							<CFormInput
								type="number"
								value={config.tcp_listen_port}
								onChange={(e) => setValue('tcp_listen_port', e.currentTarget.value)}
							/>
						</div>
					</div>
				)}
			</div>
			<div className="indent3">
				<CFormCheck
					label="UDP Raw Socket"
					checked={config.udp_enabled}
					onChange={(e) => setValue('udp_enabled', e.currentTarget.checked)}
				/>
				{config.udp_enabled && (
					<div className="indent2, group">
						<div className="col-left">Listen Port</div>
						<div className="col-right">
							<CFormInput
								type="number"
								value={config.udp_listen_port}
								onChange={(e) => setValue('udp_listen_port', e.currentTarget.value)}
							/>
						</div>
					</div>
				)}
			</div>
			<div className="indent3">
				<CFormCheck
					label="Open Sound Control (OSC)"
					checked={config.osc_enabled}
					onChange={(e) => setValue('osc_enabled', e.currentTarget.checked)}
				/>
				{config.osc_enabled && (
					<div className="indent2, group">
						<div className="col-left">Listen Port</div>
						<div className="col-right">
							<CFormInput
								type="number"
								value={config.osc_listen_port}
								onChange={(e) => setValue('osc_listen_port', e.currentTarget.value)}
							/>
						</div>
					</div>
				)}
			</div>
			<div className="indent3">
				<CFormCheck
					label="RossTalk"
					checked={config.rosstalk_enabled}
					onChange={(e) => setValue('rosstalk_enabled', e.currentTarget.checked)}
				/>
			</div>
			<div className="indent3">
				<CFormCheck
					label="Ember+"
					checked={config.emberplus_enabled}
					onChange={(e) => setValue('emberplus_enabled', e.currentTarget.checked)}
				/>
			</div>
			<div className="indent3">
				<CFormCheck
					label="Artnet"
					checked={config.artnet_enabled}
					onChange={(e) => setValue('artnet_enabled', e.currentTarget.checked)}
				/>
				{config.artnet_enabled && (
					<div className="indent2, group">
						<div className="col-left">Universe (first is 0)</div>
						<div className="col-right">
							<CFormInput
								type="number"
								value={config.artnet_universe}
								onChange={(e) => setValue('artnet_universe', e.currentTarget.value)}
							/>
						</div>
						<br />
						<div className="col-left">Channel</div>
						<div className="col-right">
							<CFormInput
								type="number"
								value={config.artnet_channel}
								onChange={(e) => setValue('artnet_channel', e.currentTarget.value)}
							/>
						</div>
					</div>
				)}
			</div>
			<p>You can change these later and review how to use them on the 'Settings' tab in the GUI.</p>
		</div>
	)
}
