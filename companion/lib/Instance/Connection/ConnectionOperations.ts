import type { ClientEditInstanceConfig } from '@companion-app/shared/Model/Common.js'
import type { ClientConnectionConfig } from '@companion-app/shared/Model/Connections.js'
import { InstanceVersionUpdatePolicy, ModuleInstanceType } from '@companion-app/shared/Model/Instance.js'
import type { SomeCompanionInputField } from '@companion-app/shared/Model/Options.js'
import { stringifyError } from '@companion-app/shared/Stringify.js'
import { validateInputValue } from '@companion-app/shared/ValidateInputValue.js'
import type { Logger } from '../../Log/Controller.js'
import type { InstanceConfigStore } from '../ConfigStore.js'
import type { InstanceController } from '../Controller.js'

export type ConnectionOperationErrorCode = 'not_found' | 'invalid_input' | 'conflict' | 'forbidden'

export class ConnectionOperationError extends Error {
	readonly code: ConnectionOperationErrorCode
	readonly details?: unknown

	constructor(code: ConnectionOperationErrorCode, message: string, details?: unknown) {
		super(message)
		this.name = 'ConnectionOperationError'
		this.code = code
		this.details = details
	}
}

export interface ConnectionOperationsDeps {
	logger: Logger
	instanceController: InstanceController
	configStore?: InstanceConfigStore
}

export interface CreateConnectionInput {
	moduleId: string
	product?: string
	label: string
	versionId: string | null
	updatePolicy?: InstanceVersionUpdatePolicy
	disabled?: boolean
}

export interface SetConnectionConfigInput {
	connectionId: string
	label?: string | null
	enabled?: boolean | null
	config?: Record<string, unknown> | null
	secrets?: Record<string, unknown> | null
	updatePolicy?: InstanceVersionUpdatePolicy | null
	patchConfig?: boolean
	patchSecrets?: boolean
	validateConfigValues?: boolean
}

export interface SetConnectionModuleVersionInput {
	connectionId: string
	moduleId?: string
	versionId: string | null
}

export interface ReorderConnectionInput {
	collectionId: string | null
	connectionId: string
	dropIndex: number
}

export interface MoveConnectionInput {
	connectionId: string
	collectionId: string | null
	position: number
}

/**
 * Ensure every field has a unique id.
 *
 * Some modules incorrectly reuse the same id for multiple `static-text` fields. This breaks React (duplicate keys),
 * but since these fields are purely visual and have no value, we can safely give each one a unique but stable id by
 * suffixing it with its index in the array.
 */
function ensureUniqueFieldIds(fields: SomeCompanionInputField[]): SomeCompanionInputField[] {
	return fields.map((field, index) => {
		if (field.type !== 'static-text') return field

		return { ...field, id: `${field.id}_${index}` }
	})
}

export class ConnectionOperations {
	readonly #logger: Logger
	readonly #instanceController: InstanceController
	readonly #configStore?: InstanceConfigStore

	constructor(deps: ConnectionOperationsDeps) {
		this.#logger = deps.logger
		this.#instanceController = deps.instanceController
		this.#configStore = deps.configStore
	}

	async createConnection(input: CreateConnectionInput): Promise<string> {
		const updatePolicy = input.updatePolicy ?? InstanceVersionUpdatePolicy.Stable
		const disabled = input.disabled ?? false

		await this.#validateModuleVersion(input.moduleId, input.versionId)

		try {
			const connectionData = input.product ? { type: input.moduleId, product: input.product } : { type: input.moduleId }
			const [id] = this.#instanceController.addConnectionWithLabel(connectionData, input.label, {
				versionId: input.versionId,
				updatePolicy,
				disabled,
			})

			this.#logger.info(`Created connection "${input.label}" (${id})`)
			return id
		} catch (e) {
			throw new ConnectionOperationError(
				'invalid_input',
				e instanceof Error ? e.message : 'Failed to create connection'
			)
		}
	}

	async deleteConnection(connectionId: string): Promise<void> {
		this.#getConnectionOrThrow(connectionId)

		await this.#instanceController.removeConnection(connectionId)
		this.#logger.info(`Deleted connection ${connectionId}`)
	}

	setConnectionEnabled(connectionId: string, enabled: boolean): void {
		this.#getConnectionOrThrow(connectionId)
		this.#instanceController.enableDisableConnection(connectionId, enabled)
	}

	reorderConnection(input: ReorderConnectionInput): void {
		if (!this.#configStore) throw new Error('Connection reorder requires configStore')
		this.#getConnectionOrThrow(input.connectionId)
		this.#configStore.moveInstance(
			input.collectionId,
			ModuleInstanceType.Connection,
			input.connectionId,
			input.dropIndex
		)
	}

	moveConnections(operations: MoveConnectionInput[]): void {
		if (!this.#configStore) throw new Error('Connection move requires configStore')

		const seenConnectionIds = new Set<string>()
		for (const [operationIndex, operation] of operations.entries()) {
			if (seenConnectionIds.has(operation.connectionId)) {
				throw new ConnectionOperationError('invalid_input', 'A connection can only be moved once per request', {
					operationIndex,
					connectionId: operation.connectionId,
				})
			}
			seenConnectionIds.add(operation.connectionId)

			if (!this.#instanceController.getConnectionClientJson(true)[operation.connectionId]) {
				throw new ConnectionOperationError('not_found', 'Connection not found', {
					operationIndex,
					connectionId: operation.connectionId,
				})
			}

			if (!this.#instanceController.connectionCollections.doesCollectionIdExist(operation.collectionId)) {
				throw new ConnectionOperationError('not_found', 'Connection collection not found', {
					operationIndex,
					collectionId: operation.collectionId,
				})
			}
		}

		const result = this.#configStore.moveInstances(ModuleInstanceType.Connection, operations)
		if (!result.ok) {
			throw new ConnectionOperationError(
				result.reason === 'not_found' ? 'not_found' : 'invalid_input',
				result.message,
				{ operationIndex: result.operationIndex }
			)
		}
	}

	async getConnectionEditConfig(connectionId: string): Promise<ClientEditInstanceConfig | null> {
		if (!this.#configStore) throw new Error('Connection edit config requires configStore')

		const instanceConf = this.#configStore.getConfigOfTypeForId(connectionId, ModuleInstanceType.Connection)
		if (!instanceConf) return null

		if (!this.#instanceController.connectionCollections.isCollectionEnabled(instanceConf.collectionId)) return null

		const instance = this.#instanceController.processManager.getConnectionChild(connectionId)
		if (!instance) return null

		try {
			const fields = await instance.requestConfigFields()

			return {
				fields: ensureUniqueFieldIds(fields),
				useNewLayout: instance.usesNewConfigLayout,
				config: instanceConf.config,
				secrets: instanceConf.secrets || {},
			}
		} catch (e) {
			this.#logger.silly(`Failed to load instance config_fields: ${stringifyError(e)}`)
			return null
		}
	}

	async getConnectionConfigFields(connectionId: string): Promise<SomeCompanionInputField[]> {
		this.#getConnectionOrThrow(connectionId)
		return this.#requestConnectionConfigFields(connectionId)
	}

	async setConnectionConfig(input: SetConnectionConfigInput): Promise<void> {
		this.#getConnectionOrThrow(input.connectionId)

		if (input.validateConfigValues && (input.config || input.secrets)) {
			await this.validateConnectionConfigValues(
				input.connectionId,
				input.config ?? undefined,
				input.secrets ?? undefined
			)
		}

		this.#applyConnectionConfig(input)
	}

	#applyConnectionConfig(input: SetConnectionConfigInput): void {
		const result = this.#instanceController.setConnectionLabelAndConfig(
			input.connectionId,
			{
				label: input.label ?? null,
				enabled: input.enabled ?? null,
				config: input.config ?? null,
				secrets: input.secrets ?? null,
				updatePolicy: input.updatePolicy ?? null,
				upgradeIndex: null,
			},
			{
				patchConfig: input.patchConfig,
				patchSecrets: input.patchSecrets,
			}
		)

		if (!result.ok) throw new ConnectionOperationError('invalid_input', result.message)
	}

	async setConnectionModuleVersion(input: SetConnectionModuleVersionInput): Promise<void> {
		const connection = this.#getConnectionOrThrow(input.connectionId)
		const moduleId = input.moduleId ?? connection.moduleId

		if (input.versionId !== null) {
			await this.#validateExistingConnectionVersion(moduleId, input.versionId)
		}

		const version = input.moduleId ? `${input.moduleId}@${input.versionId ?? ''}` : input.versionId
		const result = this.#instanceController.setModuleVersionAndActivate(input.connectionId, version, null)
		if (!result) throw new ConnectionOperationError('invalid_input', 'Failed to update connection version')
	}

	async patchConnection(input: SetConnectionConfigInput & { versionId?: string | null }): Promise<void> {
		const connection = this.#getConnectionOrThrow(input.connectionId)

		if (input.versionId !== undefined) {
			if (input.versionId !== null) {
				await this.#validateExistingConnectionVersion(connection.moduleId, input.versionId)
			}

			const versionResult = this.#instanceController.setModuleVersionAndActivate(
				input.connectionId,
				input.versionId,
				null
			)
			if (!versionResult) throw new ConnectionOperationError('invalid_input', 'Failed to update connection version')
		}

		if (input.validateConfigValues && (input.config || input.secrets)) {
			await this.validateConnectionConfigValues(
				input.connectionId,
				input.config ?? undefined,
				input.secrets ?? undefined,
				{
					skipExistsCheck: true,
				}
			)
		}

		this.#applyConnectionConfig(input)
	}

	restartConnection(connectionId: string): void {
		this.#getConnectionOrThrow(connectionId)

		const result = this.#instanceController.restartConnection(connectionId)
		if (!result) throw new ConnectionOperationError('conflict', 'Connection is inactive and cannot be restarted')

		this.#logger.info(`Restarted connection ${connectionId}`)
	}

	async validateConnectionConfigValues(
		connectionId: string,
		config: Record<string, unknown> | undefined,
		secrets: Record<string, unknown> | undefined,
		options?: { skipExistsCheck?: boolean }
	): Promise<void> {
		const fields = options?.skipExistsCheck
			? await this.#requestConnectionConfigFields(connectionId)
			: await this.getConnectionConfigFields(connectionId)
		const errors: Record<string, string> = {}
		const fieldMap = new Map<string, SomeCompanionInputField>()

		for (const field of fields) {
			fieldMap.set(field.id, field)
		}

		if (config) {
			for (const [key, value] of Object.entries(config)) {
				const field = fieldMap.get(key)
				if (!field) {
					errors[`config.${key}`] = `Unknown config field: "${key}"`
					continue
				}
				if (field.type === 'secret-text') {
					errors[`config.${key}`] = `Field "${key}" is a secret and must be sent in "secrets", not "config"`
					continue
				}
				const result = validateInputValue(field, value as any)
				if (result.validationError) errors[`config.${key}`] = result.validationError
			}
		}

		if (secrets) {
			for (const [key, value] of Object.entries(secrets)) {
				const field = fieldMap.get(key)
				if (!field) {
					errors[`secrets.${key}`] = `Unknown secret field: "${key}"`
					continue
				}
				if (field.type !== 'secret-text') {
					errors[`secrets.${key}`] = `Field "${key}" is not a secret and must be sent in "config", not "secrets"`
					continue
				}
				const result = validateInputValue(field, value as any)
				if (result.validationError) errors[`secrets.${key}`] = result.validationError
			}
		}

		if (Object.keys(errors).length > 0) {
			throw new ConnectionOperationError('invalid_input', 'Config validation failed', errors)
		}
	}

	async #requestConnectionConfigFields(connectionId: string): Promise<SomeCompanionInputField[]> {
		const instance = this.#instanceController.processManager.getConnectionChild(connectionId)
		if (!instance) throw new ConnectionOperationError('conflict', 'Connection is not running')

		try {
			return await instance.requestConfigFields()
		} catch {
			throw new ConnectionOperationError('conflict', 'Failed to retrieve config fields from module')
		}
	}

	#getConnectionOrThrow(connectionId: string): ClientConnectionConfig {
		const connection = this.#instanceController.getConnectionClientJson(true)[connectionId]
		if (!connection) throw new ConnectionOperationError('not_found', 'Connection not found')
		return connection
	}

	async #validateModuleVersion(moduleId: string, versionId: string | null): Promise<void> {
		const isInstalledModule = this.#instanceController.modules.hasModule(ModuleInstanceType.Connection, moduleId)
		const storeVersionInfo = !isInstalledModule
			? await this.#instanceController.modulesStore.fetchModuleVersionInfo(
					ModuleInstanceType.Connection,
					moduleId,
					versionId,
					true
				)
			: null

		if (!isInstalledModule && !storeVersionInfo) {
			throw new ConnectionOperationError('invalid_input', `Unknown module id: "${moduleId}"`)
		}

		if (versionId) {
			const versionInfo =
				this.#instanceController.modules.getModuleManifest(ModuleInstanceType.Connection, moduleId, versionId) ??
				storeVersionInfo
			if (!versionInfo) {
				throw new ConnectionOperationError('invalid_input', `Unknown version "${versionId}" for module "${moduleId}"`)
			}
		}
	}

	async #validateExistingConnectionVersion(moduleId: string, versionId: string): Promise<void> {
		const versionInfo =
			this.#instanceController.modules.getModuleManifest(ModuleInstanceType.Connection, moduleId, versionId) ??
			(await this.#instanceController.modulesStore.fetchModuleVersionInfo(
				ModuleInstanceType.Connection,
				moduleId,
				versionId,
				true
			))

		if (!versionInfo) {
			throw new ConnectionOperationError('invalid_input', `Unknown version "${versionId}" for module "${moduleId}"`)
		}
	}
}
