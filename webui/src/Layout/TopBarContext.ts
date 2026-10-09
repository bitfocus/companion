import type { IconDefinition } from '@fortawesome/free-solid-svg-icons'
import { createContext } from 'react'
import type { ContextHelpButtonProps } from './PanelIcons.js'

/** What the open page tells the top bar about itself */
export interface TopBarPage {
	icon: IconDefinition | undefined
	title: string
	helpAction: ContextHelpButtonProps['action'] | undefined
}

/**
 * Lets a page hand its title to the top bar. `null` outside the app frame (a standalone page such as a debug log
 * window), where there is no top bar and a page draws its own header instead.
 */
export const TopBarPageContext = createContext<((page: TopBarPage | null) => void) | null>(null)
