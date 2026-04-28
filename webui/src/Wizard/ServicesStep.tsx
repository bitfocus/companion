import { CFormInput } from '@coreui/react'
import type { UserConfigModel } from '@companion-app/shared/Model/UserConfigModel.js'
import { CheckboxInputFieldWithLabel } from '~/Components/CheckboxInputField'

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
			<div className="ms-2 mb-1">
				<CheckboxInputFieldWithLabel
					label="TCP Raw Socket"
					value={!!config.tcp_enabled}
					setValue={(val) => setValue('tcp_enabled', val)}
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
			<div className="ms-2 mb-1">
				<CheckboxInputFieldWithLabel
					label="UDP Raw Socket"
					value={!!config.udp_enabled}
					setValue={(val) => setValue('udp_enabled', val)}
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
			<div className="ms-2 mb-1">
				<CheckboxInputFieldWithLabel
					label="Open Sound Control (OSC)"
					value={!!config.osc_enabled}
					setValue={(val) => setValue('osc_enabled', val)}
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
			<div className="ms-2 mb-1">
				<CheckboxInputFieldWithLabel
					label="RossTalk"
					value={!!config.rosstalk_enabled}
					setValue={(val) => setValue('rosstalk_enabled', val)}
				/>
			</div>
			<div className="ms-2 mb-1">
				<CheckboxInputFieldWithLabel
					label="Ember+"
					value={!!config.emberplus_enabled}
					setValue={(val) => setValue('emberplus_enabled', val)}
				/>
			</div>
			<div className="ms-2 mb-1">
				<CheckboxInputFieldWithLabel
					label="Artnet"
					value={!!config.artnet_enabled}
					setValue={(val) => setValue('artnet_enabled', val)}
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
