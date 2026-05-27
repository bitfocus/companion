/* eslint-disable react-refresh/only-export-components */
import { Accordion as BaseAccordion } from '@base-ui/react/accordion'
import classNames from 'classnames'

// ─── Root ─────────────────────────────────────────────────────────────────────

export interface AccordionRootProps<Value = any> extends Omit<BaseAccordion.Root.Props<Value>, 'className'> {
	className?: string
}

function AccordionRoot<Value = any>({ className, ...props }: AccordionRootProps<Value>): JSX.Element {
	return <BaseAccordion.Root className={classNames('accordion2', className)} {...props} />
}

// ─── Item ─────────────────────────────────────────────────────────────────────

export interface AccordionItemProps extends Omit<BaseAccordion.Item.Props, 'className'> {
	className?: string
}

function AccordionItem({ className, ...props }: AccordionItemProps): JSX.Element {
	return <BaseAccordion.Item className={classNames('accordion2-item', className)} {...props} />
}

// ─── Header ───────────────────────────────────────────────────────────────────

export interface AccordionHeaderProps extends Omit<BaseAccordion.Header.Props, 'className'> {
	className?: string
}

function AccordionHeader({ className, ...props }: AccordionHeaderProps): JSX.Element {
	return <BaseAccordion.Header className={classNames('accordion2-header', className)} {...props} />
}

// ─── Trigger ──────────────────────────────────────────────────────────────────

export interface AccordionTriggerProps extends Omit<BaseAccordion.Trigger.Props, 'className'> {
	className?: string
}

function AccordionTrigger({ className, ...props }: AccordionTriggerProps): JSX.Element {
	return <BaseAccordion.Trigger className={classNames('accordion2-trigger', className)} {...props} />
}

// ─── Panel ────────────────────────────────────────────────────────────────────

export interface AccordionPanelProps extends Omit<BaseAccordion.Panel.Props, 'className'> {
	className?: string
}

function AccordionPanel({ className, ...props }: AccordionPanelProps): JSX.Element {
	return <BaseAccordion.Panel className={classNames('accordion2-panel', className)} {...props} />
}

// ─── Export ───────────────────────────────────────────────────────────────────

export const Accordion = {
	Root: AccordionRoot,
	Item: AccordionItem,
	Header: AccordionHeader,
	Trigger: AccordionTrigger,
	Panel: AccordionPanel,
}
