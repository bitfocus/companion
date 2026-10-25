import z from 'zod'
import { JsonObjectSchema } from './Options.js'

export enum InstanceVersionUpdatePolicy {
	Manual = 'manual',
	Stable = 'stable',
	Beta = 'beta',
}

export enum ModuleInstanceType {
	Connection = 'connection',
	Surface = 'surface',
}

export const InstanceConfigSchema = z.object({
	moduleInstanceType: z.enum(ModuleInstanceType).default(ModuleInstanceType.Connection),
	moduleId: z.string(),
	/** When null, the latest installed version is chosen when the instance starts */
	moduleVersionId: z.string().nullable().default(null),

	label: z.string(),
	/** Sent to the module, and to the ui, so must be JSON */
	config: JsonObjectSchema.default(() => ({})),
	secrets: JsonObjectSchema.default(() => ({})),
	isFirstInit: z.boolean().default(false),
	/** -1 runs every upgrade script, as the module does when it isn't given one */
	lastUpgradeIndex: z.number().default(-1),
	enabled: z.boolean().default(true),
	sortOrder: z.number().default(0),
	updatePolicy: z.enum(InstanceVersionUpdatePolicy).default(InstanceVersionUpdatePolicy.Stable),
	collectionId: z.string().optional(),
})

export type InstanceConfig = z.output<typeof InstanceConfigSchema>

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
