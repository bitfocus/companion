import { useId } from 'react'
import type { UserConfigModel } from '@companion-app/shared/Model/UserConfigModel.js'
import { CheckboxInputFieldWithLabel } from '~/Components/CheckboxInputField'
import { FormLabel } from '~/Components/Form'
import { Grid } from '~/Components/Grid'
import { NumberInputField } from '~/Components/NumberInputField'

interface ServicesStepProps {
	config: Partial<UserConfigModel>
	setValue: (key: keyof UserConfigModel, value: any) => void
}

export function ServicesStep({ config, setValue }: ServicesStepProps): React.JSX.Element {
	const tcpListenPortId = useId()
	const udpListenPortId = useId()
	const oscListenPortId = useId()
	const artnetUniveriseId = useId()
	const artnetChannelId = useId()

	return (
		<Grid.Row>
			<Grid.Col sm={12}>
				<h5>Remote Control Services</h5>
				<p>
					In addition to USB hardware, Companion is able to be controlled over the network by various different methods.
					Since these expose Companion to control via your network, it is only recommended to enable the services you
					need.
				</p>
			</Grid.Col>

			<Grid.Col xs={12} className="ms-2 mb-1">
				<CheckboxInputFieldWithLabel
					label="TCP Raw Socket"
					value={!!config.tcp_enabled}
					setValue={(val) => setValue('tcp_enabled', val)}
				/>
			</Grid.Col>
			{config.tcp_enabled && (
				<>
					<FormLabel htmlFor={tcpListenPortId} className="col-sm-4 offset-sm-1 col-form-label col-form-label-sm mb-2">
						Listen Port
					</FormLabel>
					<Grid.Col sm={5} className="mb-2">
						<NumberInputField
							id={tcpListenPortId}
							value={config.tcp_listen_port}
							setValue={(value) => setValue('tcp_listen_port', value)}
							immediateValue
						/>
					</Grid.Col>
					<Grid.Col sm={2}></Grid.Col>
				</>
			)}

			<Grid.Col xs={12} className="ms-2 mb-1">
				<CheckboxInputFieldWithLabel
					label="UDP Raw Socket"
					value={!!config.udp_enabled}
					setValue={(val) => setValue('udp_enabled', val)}
				/>
			</Grid.Col>
			{config.udp_enabled && (
				<>
					<FormLabel htmlFor={udpListenPortId} className="col-sm-4 offset-sm-1 col-form-label col-form-label-sm mb-2">
						Listen Port
					</FormLabel>
					<Grid.Col sm={5} className="mb-2">
						<NumberInputField
							id={udpListenPortId}
							value={config.udp_listen_port}
							setValue={(value) => setValue('udp_listen_port', value)}
							immediateValue
						/>
					</Grid.Col>
					<Grid.Col sm={2}></Grid.Col>
				</>
			)}

			<Grid.Col xs={12} className="ms-2 mb-1">
				<CheckboxInputFieldWithLabel
					label="Open Sound Control (OSC)"
					value={!!config.osc_enabled}
					setValue={(val) => setValue('osc_enabled', val)}
				/>
			</Grid.Col>
			{config.osc_enabled && (
				<>
					<FormLabel htmlFor={oscListenPortId} className="col-sm-4 offset-sm-1 col-form-label col-form-label-sm mb-2">
						Listen Port
					</FormLabel>
					<Grid.Col sm={5} className="mb-2">
						<NumberInputField
							id={oscListenPortId}
							value={config.osc_listen_port}
							setValue={(value) => setValue('osc_listen_port', value)}
							immediateValue
						/>
					</Grid.Col>
					<Grid.Col sm={2}></Grid.Col>
				</>
			)}

			<Grid.Col xs={12} className="ms-2 mb-1">
				<CheckboxInputFieldWithLabel
					label="RossTalk"
					value={!!config.rosstalk_enabled}
					setValue={(val) => setValue('rosstalk_enabled', val)}
				/>
			</Grid.Col>
			<Grid.Col xs={12} className="ms-2 mb-1">
				<CheckboxInputFieldWithLabel
					label="Ember+"
					value={!!config.emberplus_enabled}
					setValue={(val) => setValue('emberplus_enabled', val)}
				/>
			</Grid.Col>

			<Grid.Col xs={12} className="ms-2 mb-1">
				<CheckboxInputFieldWithLabel
					label="Artnet"
					value={!!config.artnet_enabled}
					setValue={(val) => setValue('artnet_enabled', val)}
				/>
			</Grid.Col>
			{config.artnet_enabled && (
				<>
					<FormLabel htmlFor={artnetUniveriseId} className="col-sm-4 offset-sm-1 col-form-label col-form-label-sm mb-2">
						Universe (first is 0)
					</FormLabel>
					<Grid.Col sm={5} className="mb-2">
						<NumberInputField
							id={artnetUniveriseId}
							value={config.artnet_universe}
							setValue={(value) => setValue('artnet_universe', value)}
							min={0}
							max={20055}
							immediateValue
						/>
					</Grid.Col>
					<Grid.Col sm={2}></Grid.Col>

					<FormLabel htmlFor={artnetChannelId} className="col-sm-4 offset-sm-1 col-form-label col-form-label-sm mb-2">
						Channel
					</FormLabel>
					<Grid.Col sm={5} className="mb-2">
						<NumberInputField
							id={artnetChannelId}
							value={config.artnet_channel}
							setValue={(value) => setValue('artnet_channel', value)}
							min={1}
							max={509}
							immediateValue
						/>
					</Grid.Col>
					<Grid.Col sm={2}></Grid.Col>
				</>
			)}

			<Grid.Col sm={12}>
				<p className="text-muted mt-3" style={{ fontSize: '0.875rem' }}>
					You can change these later and review how to use them on the 'Settings' tab in the GUI.
				</p>
			</Grid.Col>
		</Grid.Row>
	)
}
