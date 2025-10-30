// eslint-disable-next-line @typescript-eslint/consistent-type-imports
export type WhatsNewContent = typeof import('*?raw')

export interface WhatsNewPage {
	version: string
	label: string
	file: WhatsNewContent
}

export const Pages: WhatsNewPage[] = [
	{
		version: '4.1.0',
		label: 'v4.1.0',
		file: await import('../../../docs/docs/9_whatsnew/v4-1-0.md?raw'),
	},
	{
		version: '4.0.0',
		label: 'v4.0.0',
		file: await import('../../../docs/docs/9_whatsnew/v4-0-0.md?raw'),
	},
	{
		version: '3.5.0',
		label: 'v3.5.0',
		file: await import('../../../docs/docs/9_whatsnew/v3-5-0.md?raw'),
	},
	{
		version: '3.4.0',
		label: 'v3.4.0',
		file: await import('../../../docs/docs/9_whatsnew/v3-4-0.md?raw'),
	},
]
