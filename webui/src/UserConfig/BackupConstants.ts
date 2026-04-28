export const backupTypes = [
	{ label: 'Raw Database', id: 'db' },
	{ label: 'Compressed (Default)', id: 'export-gz' },
	{ label: 'JSON (Standard)', id: 'export-json' },
	{ label: 'YAML (More human readable)', id: 'export-yaml' },
] as const
