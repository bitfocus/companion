import type { UserConfigModel } from '@companion-app/shared/Model/UserConfigModel.js'
import {
	WIZARD_VERSION_2_2,
	WIZARD_VERSION_3_4,
	WIZARD_VERSION_4_2,
	WIZARD_VERSION_4_3,
	WIZARD_VERSION_5_0,
} from './Constants.js'
import { DataCollectionStep } from './DataCollectionStep.js'
import { GridStep } from './GridStep.js'
import { PasswordStep } from './PasswordStep.js'
import { ServicesStep } from './ServicesStep.js'
import { SurfacesStep } from './SurfacesStep.js'
import { TimezoneStep } from './TimezoneStep.js'

export interface WizardStepContext {
	config: UserConfigModel
	setValue: (key: keyof UserConfigModel, value: any) => void
}

export interface WizardStepDef {
	/** Stable identifier for the step */
	id: string
	/** Short label shown in the stepper */
	title: string
	/**
	 * The most recent wizard version in which this step gained content worth re-showing.
	 * A step is shown to an upgrading user when `revisedInVersion > theirPreviousVersion`.
	 * Bump this (whether the step is brand new or an existing step got new content) to opt
	 * it back into the short upgrade flow. See Constants.ts for the version history.
	 */
	revisedInVersion: number
	/** When provided and it returns false, the step is omitted from the wizard entirely */
	isAvailable?: (config: UserConfigModel) => boolean
	render: (ctx: WizardStepContext) => React.ReactNode
}

/**
 * The ordered list of configurable steps shown between the intro (Begin) and review (Apply) steps.
 * Begin/Apply/Finish are framing steps handled directly by the wizard and are not part of this list.
 */
export const WIZARD_CONFIG_STEPS: WizardStepDef[] = [
	{
		id: 'surfaces',
		title: 'Surfaces',
		revisedInVersion: WIZARD_VERSION_4_3,
		render: ({ config, setValue }) => <SurfacesStep config={config} setValue={setValue} />,
	},
	{
		id: 'grid',
		title: 'Button Grid',
		revisedInVersion: WIZARD_VERSION_3_4,
		isAvailable: (config) => config.gridSize.minColumn === 0 && config.gridSize.minRow === 0,
		render: ({ config, setValue }) => (
			<GridStep rows={config.gridSize.maxRow + 1} columns={config.gridSize.maxColumn + 1} setValue={setValue} />
		),
	},
	{
		id: 'services',
		title: 'Services',
		revisedInVersion: WIZARD_VERSION_2_2,
		render: ({ config, setValue }) => <ServicesStep config={config} setValue={setValue} />,
	},
	{
		id: 'data-collection',
		title: 'Usage Stats',
		revisedInVersion: WIZARD_VERSION_4_2,
		render: ({ config, setValue }) => <DataCollectionStep config={config} setValue={setValue} />,
	},
	{
		id: 'password',
		title: 'Password',
		revisedInVersion: WIZARD_VERSION_2_2,
		render: ({ config, setValue }) => <PasswordStep config={config} setValue={setValue} />,
	},
	{
		id: 'timezone',
		title: 'Timezone',
		revisedInVersion: WIZARD_VERSION_5_0,
		render: ({ config, setValue }) => <TimezoneStep config={config} setValue={setValue} />,
	},
]
