import { ServiceBase } from './Base.js'
import type { ServiceApi } from './ServiceApi.js'
import type { DataUserConfig } from '../Data/UserConfig.js'

import mqtt from 'mqtt'

export class MqttService extends ServiceBase {
	readonly #serviceApi: ServiceApi

	broker: string = 'localhost'
	port: number = 1883
	topic: string = 'companion'
	username: string = ''
	password: string = ''

	#client: mqtt.MqttClient | null = null

	constructor(serviceApi: ServiceApi, userconfig: DataUserConfig) {
		super(userconfig, 'Service/Mqtt', 'mqtt_enabled', null)

		this.logger.info('MqttService: constructor')

		this.#serviceApi = serviceApi

		this.init()
	}

	/** Initialize the MQTT service */
	protected listen(): void {
		this.broker = this.userconfig.getKey('mqtt_broker')
		this.port = this.userconfig.getKey('mqtt_port') || 1883
		this.topic = this.userconfig.getKey('mqtt_topic') || 'companion'
		this.username = this.userconfig.getKey('mqtt_username') || ''
		this.password = this.userconfig.getKey('mqtt_password') || ''

		const options: mqtt.IClientOptions = {
			username: this.username || undefined,
			password: this.password || undefined,
		}

		this.logger.info(`Connecting to MQTT broker at ${this.broker}:${this.port}...`)

		try {
			this.#client = mqtt.connect(`mqtt://${this.broker}:${this.port}`, options)

			this.#client.on('connect', () => {
				this.currentState = true
				this.logger.info(`Connected to MQTT broker at ${this.broker}:${this.port}`)

				// Set up event listeners for variable change
				this.startEventListeners()
			})

			this.#client.on('error', (error) => {
				this.logger.error(`MQTT error: ${error.message}`)
				this.currentState = false
			})

			this.#client.on('close', () => {
				this.logger.info('Disconnected from MQTT broker')
				this.#client?.end()
				this.currentState = false
			})
		} catch (error) {
			this.logger.error(`Failed to connect to MQTT broker: ${(error as Error).message}`)
			this.currentState = false
			return
		}
	}

	protected close(): void {
		if (this.#client) {
			this.#client.end()
			this.#client = null
			this.currentState = false
			this.logger.info('Disconnected from MQTT broker')
		}
	}

	private startEventListeners(): void {
		//this.logger.info('Starting MQTT event listeners for variable changes')
		this.#serviceApi.on('variables_changed', (variables) => {
			if (this.#client === null) return

			for (const variable of variables) {
				let [label, name] = variable.split(':')

				if (label == 'internal' && name.startsWith('custom')) {
					label = 'custom'
					name = name.substring(7)
				}

				let value = undefined

				if (label === 'custom') {
					value = this.#serviceApi.getCustomVariableValue(name)?.toString()
					if (value === undefined) return
				} else {
					value = this.#serviceApi.getConnectionVariableValue(label, name)?.toString()
					if (value === undefined) return
				}

				const topic = `${this.topic}/variables/${label}/${name}`
				const message = value

				this.#client.publish(topic, message, (err) => {
					if (err) {
						this.logger.error(`Failed to publish MQTT message: ${err.message}`)
					}
				})
			}
		})
	}
}
