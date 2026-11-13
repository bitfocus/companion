import { createFileRoute } from '@tanstack/react-router'
import { CustomPresetsPage } from '~/CustomPresets/Page.js'

export const Route = createFileRoute('/_app/custom-presets')({
	component: CustomPresetsPage,
})
