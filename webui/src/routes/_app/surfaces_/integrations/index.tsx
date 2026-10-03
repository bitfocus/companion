import { createFileRoute } from '@tanstack/react-router'
import { SurfaceSettingsPanel } from '~/Surfaces/SurfaceSettingsPanel'

export const Route = createFileRoute('/_app/surfaces_/integrations/')({
	component: SurfaceSettingsPanel,
})
