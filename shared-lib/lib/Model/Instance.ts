export enum InstanceVersionUpdatePolicy {
	Manual = 'manual',
	Stable = 'stable',
	Beta = 'beta',
}

export enum ModuleInstanceType {
	Connection = 'connection',
	Surface = 'surface',
}

export interface InstanceConfig {
	moduleInstanceType: ModuleInstanceType
	moduleId: string
	moduleVersionId: string | null

	label: string
	config: unknown
	secrets: unknown | undefined
	isFirstInit: boolean
	lastUpgradeIndex: number
	enabled: boolean
	sortOrder: number
	updatePolicy: InstanceVersionUpdatePolicy
	collectionId?: string
}

export interface ClientInstanceConfigBase {
	id: string
	label: string
	moduleType: ModuleInstanceType
	moduleId: string
	moduleVersionId: string | null
	updatePolicy: InstanceVersionUpdatePolicy
	enabled: boolean
	sortOrder: number
	collectionId: string | null
}
