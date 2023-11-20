import React from 'react'
import { CInput, CInputCheckbox, CLabel } from '@coreui/react'
import type { UserConfigModel } from '@companion/shared/Model/UserConfigModel'

interface ServicesStepProps {
	config: Partial<UserConfigModel>
	setValue: (key: keyof UserConfigModel, value: any) => void
}

export function ServicesStep({ config, setValue }: ServicesStepProps) {
	return (
		<div>
			<h5>Remote Control Services</h5>
			<p>
				In addition to USB hardware, Companion is able to be controlled over the network by various different methods.
				Since these expose Companion to control via your network, it is only recommended to enable the services you
				need.
			</p>
			<div className="indent3">
				<div className="form-check form-check-inline mr-1">
					<CInputCheckbox
						id="userconfig_tcp_enabled"
						checked={config.tcp_enabled}
						onChange={(e) => setValue('tcp_enabled', e.currentTarget.checked)}
					/>
					<CLabel htmlFor="userconfig_tcp_enabled">TCP Raw Socket</CLabel>
				</div>
				{config.tcp_enabled && (
					<div className="indent2, group">
						<div className="col-left">Listen Port</div>
						<div className="col-right">
							<div className="form-check form-check-inline mr-1">
								<CInput
									type="number"
									value={config.tcp_listen_port}
									onChange={(e) => setValue('tcp_listen_port', e.currentTarget.value)}
								/>
							</div>
						</div>
					</div>
				)}
			</div>
			<div className="indent3">
				<div className="form-check form-check-inline mr-1">
					<CInputCheckbox
						id="userconfig_udp_enabled"
						checked={config.udp_enabled}
						onChange={(e) => setValue('udp_enabled', e.currentTarget.checked)}
					/>
					<CLabel htmlFor="userconfig_udp_enabled">UDP Raw Socket</CLabel>
				</div>
				{config.udp_enabled && (
					<div className="indent2, group">
						<div className="col-left">Listen Port</div>
						<div className="col-right">
							<div className="form-check form-check-inline mr-1">
								<CInput
									type="number"
									value={config.udp_listen_port}
									onChange={(e) => setValue('udp_listen_port', e.currentTarget.value)}
								/>
							</div>
						</div>
					</div>
				)}
			</div>
			<div className="indent3">
				<div className="form-check form-check-inline mr-1">
					<CInputCheckbox
						id="userconfig_osc_enabled"
						checked={config.osc_enabled}
						onChange={(e) => setValue('osc_enabled', e.currentTarget.checked)}
					/>
					<CLabel htmlFor="userconfig_osc_enabled">Open Sound Control (OSC)</CLabel>
				</div>
				{config.osc_enabled && (
					<div className="indent2, group">
						<div className="col-left">Listen Port</div>
						<div className="col-right">
							<div className="form-check form-check-inline mr-1">
								<CInput
									type="number"
									value={config.osc_listen_port}
									onChange={(e) => setValue('osc_listen_port', e.currentTarget.value)}
								/>
							</div>
						</div>
					</div>
				)}
			</div>
			<div className="indent3">
				<div className="form-check form-check-inline mr-1">
					<CInputCheckbox
						id="userconfig_rosstalk_enabled"
						checked={config.rosstalk_enabled}
						onChange={(e) => setValue('rosstalk_enabled', e.currentTarget.checked)}
					/>
					<CLabel htmlFor="userconfig_rosstalk_enabled">RossTalk</CLabel>
				</div>
			</div>
			<div className="indent3">
				<div className="form-check form-check-inline mr-1">
					<CInputCheckbox
						id="userconfig_emberplus_enabled"
						checked={config.emberplus_enabled}
						onChange={(e) => setValue('emberplus_enabled', e.currentTarget.checked)}
					/>
					<CLabel htmlFor="userconfig_emberplus_enabled">Ember+</CLabel>
				</div>
			</div>
			<div className="indent3">
				<div className="form-check form-check-inline mr-1">
					<CInputCheckbox
						id="userconfig_artnet_enabled"
						checked={config.artnet_enabled}
						onChange={(e) => setValue('artnet_enabled', e.currentTarget.checked)}
					/>
					<CLabel htmlFor="userconfig_artnet_enabled">Artnet</CLabel>
				</div>
				{config.artnet_enabled && (
					<div className="indent2, group">
						<div className="col-left">Universe (first is 0)</div>
						<div className="col-right">
							<div className="form-check form-check-inline mr-1">
								<CInput
									type="number"
									value={config.artnet_universe}
									onChange={(e) => setValue('artnet_universe', e.currentTarget.value)}
								/>
							</div>
						</div>
						<br />
						<div className="col-left">Channel</div>
						<div className="col-right">
							<div className="form-check form-check-inline mr-1">
								<CInput
									type="number"
									value={config.artnet_channel}
									onChange={(e) => setValue('artnet_channel', e.currentTarget.value)}
								/>
							</div>
						</div>
					</div>
				)}
			</div>
			<p>You can change these later and review how to use them on the 'Settings' tab in the GUI.</p>
		</div>
	)
}
