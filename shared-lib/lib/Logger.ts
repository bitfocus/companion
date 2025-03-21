export interface MinimalLogger {
	error: MinimalLoggerMethod
	warn: MinimalLoggerMethod
	info: MinimalLoggerMethod
	debug: MinimalLoggerMethod
}

export type MinimalLoggerMethod = (message: string, ...args: any[]) => void
