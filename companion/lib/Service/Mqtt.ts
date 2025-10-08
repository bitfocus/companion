import { ServiceBase } from './Base.js'
import type { ServiceApi } from './ServiceApi.js'
import type { DataUserConfig } from '../Data/UserConfig.js'

import mqtt from 'mqtt'

export class MqttService extends ServiceBase {
	readonly #serviceApi: ServiceApi

	readonly #releaseTime = 20

	broker: string = 'localhost'
	port: number = 1883
	topic: string = 'companion'
	username: string = ''
	password: string = ''

	#client: mqtt.MqttClient | null = null

	constructor(serviceApi: ServiceApi, userconfig: DataUserConfig) {
		super(userconfig, 'Service/Mqtt', 'mqtt_enabled', null)

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

				// Set up event listeners
				this.startEventListeners()

				// Subscribe to actions topic
				const actionsTopic = `${this.topic}/commands/#`
				this.#client!.subscribe(actionsTopic, (err) => {
					if (err) {
						this.logger.error(`Failed to subscribe to MQTT topic ${actionsTopic}: ${err.message}`)
					}
				})

				// Handle incoming messages
				this.#client!.on('message', (topic, message) => {
					this.handleMessage(topic, message)
					this.logger.debug(`Received MQTT message on topic ${topic}: ${message.toString()}`)
				})
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
		}
	}

	private startEventListeners(): void {
		// Listen for variable changes
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

	private handleMessage(topic: string, message: any): void {
		if (this.#client === null) return

		// Strip topic prefix
		const baseTopic = `${this.topic}/commands/`
		topic = topic.slice(baseTopic.length)

		const parts = topic.split('/')

		if (parts[0] === 'location') {
			// Handle button actions based on location
			// Expected format: location/<page>/<row>/<column>/<action>
			const match = topic.match(/location\/([0-9]+)\/([0-9]+)\/([0-9]+)\/([a-zA-Z0-9_]+)/)
			if (!match) {
				this.logger.info(`Invalid MQTT location command format: ${topic}`)
				return
			}
			const [page, row, column, action] = match.slice(1)

			const controlId = this.#serviceApi.getControlIdAt({
				pageNumber: parseInt(page),
				row: parseInt(row),
				column: parseInt(column),
			})
			if (!controlId) {
				this.logger.info(`No button found at Page ${page}, Row ${row}, Column ${column}`)
				return
			}

			if (action === 'press') {
				this.#serviceApi.pressControl(controlId, true, 'mqtt')

				setTimeout(() => {
					this.#serviceApi.pressControl(controlId, false, 'mqtt')
				}, this.#releaseTime)
			}
			if (action === 'down') {
				this.#serviceApi.pressControl(controlId, true, 'mqtt')
			}
			if (action === 'up') {
				this.#serviceApi.pressControl(controlId, false, 'mqtt')
			}
		}
		if (parts[0] === 'custom-variable') {
			// Handle custom variable actions
			const varName = parts[1]
			const action = parts[2] ?? 'value' // Default to value but allow for future actions
			if (!varName) return

			if (action === 'value') {
				const value = message.toString()
				this.#serviceApi.setCustomVariableValue(varName, value)
			}
		}
	}
}
