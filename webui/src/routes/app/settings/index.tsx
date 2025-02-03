import { createFileRoute } from '@tanstack/react-router'
import { SettingsSelectPage } from '../../../UserConfig/index.js'

export const Route = createFileRoute('/_app/settings/')({
  component: SettingsSelectPage,
})
