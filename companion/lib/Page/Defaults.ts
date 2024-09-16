export interface NavButtonDefinition {
	type: 'pageup' | 'pagedown' | 'pagenum'
	location: {
		column: number
		row: number
	}
}
/**
 * Default buttons on fresh pages
 */
export const default_nav_buttons_definitions: NavButtonDefinition[] = [
	{
		type: 'pageup',
		location: {
			column: 0,
			row: 0,
		},
	},
	{
		type: 'pagenum',
		location: {
			column: 0,
			row: 1,
		},
	},
	{
		type: 'pagedown',
		location: {
			column: 0,
			row: 2,
		},
	},
]
