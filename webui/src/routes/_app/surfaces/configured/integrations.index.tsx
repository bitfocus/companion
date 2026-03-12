import { createFileRoute, redirect } from '@tanstack/react-router'

// define this route purely to allow "fuzzy" search for subroutes in '/surfaces/configured'
export const Route = createFileRoute('/_app/surfaces/configured/integrations/')({
	beforeLoad: () => {
		throw redirect({ to: '/surfaces/configured' })
	},
})
