import React, { type ReactNode } from 'react'
import Content from '@theme-original/DocSidebar/Desktop/Content'
import type ContentType from '@theme/DocSidebar/Desktop/Content'
import type { WrapperProps } from '@docusaurus/types'
import { useColorMode } from '@docusaurus/theme-common'
import styles from './styles.module.css'

type Props = WrapperProps<typeof ContentType>

export default function ContentWrapper(props: Props): ReactNode {
	const { colorMode, setColorMode } = useColorMode()

	const toggleColorMode = () => {
		setColorMode(colorMode === 'dark' ? 'light' : 'dark')
	}

	return (
		<>
			<Content {...props} />
			<div className={styles.colorModeToggle}>
				<button
					type="button"
					onClick={toggleColorMode}
					title={`Switch to ${colorMode === 'dark' ? 'light' : 'dark'} mode`}
					aria-label={`Switch to ${colorMode === 'dark' ? 'light' : 'dark'} mode`}
					className={styles.toggleButton}
				>
					<span className={styles.toggleIcon}>{colorMode === 'dark' ? '☀️' : '🌙'}</span>
				</button>
			</div>
		</>
	)
}
