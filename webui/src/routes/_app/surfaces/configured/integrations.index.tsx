import { createFileRoute } from '@tanstack/react-router'
import { SurfaceSettingsPanel } from '~/Surfaces/SurfaceSettingsPanel'

// define this route (a) as a flag to show the settings panel in narrow mode
// and (b) to allow "fuzzy" search for subroutes in '/surfaces/configured' (i.e. even if reason (a) is no longer  used)
export const Route = createFileRoute('/_app/surfaces/configured/integrations/')({
	component: SurfaceSettingsPanel,
})
