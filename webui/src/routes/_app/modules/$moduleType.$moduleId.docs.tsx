import { createFileRoute } from '@tanstack/react-router'

// Rendered by the parent route, which reads the tab from this match so the panel stays mounted
export const Route = createFileRoute('/_app/modules/$moduleType/$moduleId/docs')({})
