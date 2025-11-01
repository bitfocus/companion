import z from 'zod'

export const zodExportFormat = z.enum(['json', 'json-gz', 'yaml'])

export type ExportFormat = z.infer<typeof zodExportFormat>
