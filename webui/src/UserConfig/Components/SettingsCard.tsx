import { Table } from '~/Components/Table.js'

/**
 * One settings section: a `surface-card` wrapping the settings table. Every settings page is a stack
 * of these, so the card/table/tbody scaffolding lives here rather than being retyped per section.
 */
export function SettingsCard({ children }: { children: React.ReactNode }): React.JSX.Element {
	return (
		<div className="surface-card">
			<Table className="table-settings mb-0">
				<tbody>{children}</tbody>
			</Table>
		</div>
	)
}
