import { createFileRoute } from '@tanstack/react-router'
import { ImportExportPage } from '../../ImportExport/index.js'

export const Route = createFileRoute('/_app/import-export')({
	component: ImportExportPage,
})
