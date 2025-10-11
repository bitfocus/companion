export enum InstanceVersionUpdatePolicy {
	Manual = 'manual',
	Stable = 'stable',
	Beta = 'beta',
}

export enum ModuleInstanceType {
	Connection = 'connection',
	// Surface = 'surface', // Future
}

export interface InstanceConfig {
	moduleInstanceType: ModuleInstanceType
	instance_type: string // TODO - rename to moduleId
	moduleVersionId: string | null

	label: string
	config: unknown
	secrets: unknown | undefined
	isFirstInit: boolean
	lastUpgradeIndex: number
	enabled: boolean
	sortOrder: number
	updatePolicy: InstanceVersionUpdatePolicy // TODO - upgrade script
	collectionId?: string
}

export interface ClientInstanceConfigBase {
	label: string
	moduleType: ModuleInstanceType
	moduleId: string
	moduleVersionId: string | null
	updatePolicy: InstanceVersionUpdatePolicy
	enabled: boolean
}
