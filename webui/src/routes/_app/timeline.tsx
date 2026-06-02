import { createFileRoute } from '@tanstack/react-router'
import type { ControlLocation } from '@companion-app/shared/Model/Common.js'
import { TimelinePage } from '~/Timeline/TimelinePage.js'

interface TimelineSearch {
	page?: number
	row?: number
	column?: number
}

export const Route = createFileRoute('/_app/timeline')({
	validateSearch: (search: Record<string, unknown>): TimelineSearch => {
		const num = (v: unknown): number | undefined => {
			const n = Number(v)
			return Number.isFinite(n) ? n : undefined
		}
		return { page: num(search.page), row: num(search.row), column: num(search.column) }
	},
	component: TimelineRouteComponent,
})

function TimelineRouteComponent(): React.JSX.Element {
	const { page, row, column } = Route.useSearch()
	const initialLocation: ControlLocation | undefined =
		page != null && row != null && column != null ? { pageNumber: page, row, column } : undefined
	return <TimelinePage initialLocation={initialLocation} />
}
