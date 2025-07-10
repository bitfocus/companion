export const backupTypes = [
	{ label: 'Raw Database', value: 'db' },
	{ label: 'Compressed (Default)', value: 'export-gz' },
	{ label: 'JSON (Standard)', value: 'export-json' },
	{ label: 'YAML (More human readable)', value: 'export-yaml' },
] as const
