import type { UserConfigModel } from '@companion-app/shared/Model/UserConfigModel.js'
import { CheckboxInputFieldWithLabel } from '~/Components/CheckboxInputField'
import { NumberInputField } from '~/Components/NumberInputField'

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
					<div className="ms-3 mb-2">
						<div className="col-left">Listen Port</div>
						<div className="col-right">
							<NumberInputField
								value={config.tcp_listen_port}
								setValue={(value) => setValue('tcp_listen_port', value)}
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
					<div className="ms-3 mb-2">
						<div className="col-left">Listen Port</div>
						<div className="col-right">
							<NumberInputField
								value={config.udp_listen_port}
								setValue={(value) => setValue('udp_listen_port', value)}
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
					<div className="ms-3 mb-2">
						<div className="col-left">Listen Port</div>
						<div className="col-right">
							<NumberInputField
								value={config.osc_listen_port}
								setValue={(value) => setValue('osc_listen_port', value)}
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
					<div className="ms-3 mb-2">
						<div className="col-left">Universe (first is 0)</div>
						<div className="col-right">
							<NumberInputField
								value={config.artnet_universe}
								setValue={(value) => setValue('artnet_universe', value)}
								min={0}
								max={20055}
							/>
						</div>
						<br />
						<div className="col-left">Channel</div>
						<div className="col-right">
							<NumberInputField
								value={config.artnet_channel}
								setValue={(value) => setValue('artnet_channel', value)}
								min={1}
								max={509}
							/>
						</div>
					</div>
				)}
			</div>
			<p>You can change these later and review how to use them on the 'Settings' tab in the GUI.</p>
		</div>
	)
}
