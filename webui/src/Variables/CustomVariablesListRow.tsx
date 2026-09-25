import { faTrash } from '@fortawesome/free-solid-svg-icons'
import '../Components/VariablesTable.css'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import classNames from 'classnames'
import { observer } from 'mobx-react-lite'
import { useCallback } from 'react'
import { Button, ButtonGroup } from '~/Components/Button.js'
import { CopyButton } from '~/Components/CopyButton'
import { VariableValueDisplay } from '~/Components/VariableValueDisplay.js'
import type { CustomVariableDefinitionExt } from './CustomVariablesList'
import { useCustomVariablesTableContext } from './CustomVariablesTableContext'

interface CustomVariableRowProps {
	info: CustomVariableDefinitionExt
}

export const CustomVariableRow = observer(function CustomVariableRow({ info }: CustomVariableRowProps) {
	const fullname = `$(custom:${info.id})`

	const tableContext = useCustomVariablesTableContext()
	const isSelected = tableContext.selectedVariableId === info.id

	const value = tableContext.customVariableValues.get(info.id)

	const doEdit = useCallback(
		(e: React.MouseEvent) => {
			// The row's own buttons (copy, delete) shouldn't also open the editor
			if ((e.target as HTMLElement).closest('button, a')) return
			tableContext.selectCustomVariable(info.id)
		},
		[tableContext, info.id]
	)
	const doEditKey = useCallback(
		(e: React.KeyboardEvent) => {
			if (e.target !== e.currentTarget) return
			if (e.key === 'Enter' || e.key === ' ') {
				e.preventDefault()
				tableContext.selectCustomVariable(info.id)
			}
		},
		[tableContext, info.id]
	)

	const doDelete = useCallback(
		() => tableContext.customVariablesApi.doDelete(info.id),
		[tableContext.customVariablesApi, info.id]
	)

	return (
		<div
			role="button"
			tabIndex={0}
			onClick={doEdit}
			onKeyDown={doEditKey}
			className={classNames(
				'flex flex-row items-center gap-3 cursor-pointer py-2 px-3 rounded-lg transition-colors hover:bg-surface-muted/50',
				isSelected
					? 'bg-primary/10 font-semibold text-primary border-l-4 border-l-primary rounded-l-none'
					: 'bg-transparent'
			)}
		>
			<div className="flex flex-col grow min-w-0">
				<span className="variable-style flex items-center gap-1.5 truncate">
					<span>{fullname}</span>
					<CopyButton size="sm" title="Copy variable name" color="primary" variant="ghost" text={fullname} />
				</span>

				{info.description ? <span className="text-xs text-muted truncate">{info.description}</span> : null}
			</div>

			<div className="shrink min-w-0 basis-1/3 text-xs">
				<VariableValueDisplay value={value} compact />
			</div>

			<div className="shrink-0 flex items-center gap-1">
				<ButtonGroup>
					<Button
						color="secondary"
						size="sm"
						onClick={doDelete}
						title="Delete"
						className="text-rose-500 hover:bg-rose-500/10"
					>
						<FontAwesomeIcon icon={faTrash} />
					</Button>
				</ButtonGroup>
			</div>
		</div>
	)
})
