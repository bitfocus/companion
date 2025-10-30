export interface WhatsNewPage {
	version: string
	label: string
	file: string
}

export const Pages: WhatsNewPage[] = [
	{
		version: '4.1.0',
		label: 'v4.1.0',
		file: 'v4-1-0',
	},
	{
		version: '4.0.0',
		label: 'v4.0.0',
		file: 'v4-0-0',
	},
	{
		version: '3.5.0',
		label: 'v3.5.0',
		file: 'v3-5-0',
	},
	{
		version: '3.4.0',
		label: 'v3.4.0',
		file: 'v3-4-0',
	},
]
