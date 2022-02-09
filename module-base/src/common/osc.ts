/**
 * Warning: these types are used in various stable apis.
 * BE VERY CAREFUL WHEN MAKING CHANGES
 */

export type OSCArgument = number | string | Uint8Array
export type OSCMetaArgument =
	| { type: 'i' | 'f'; value: number }
	| { type: 's'; value: string }
	| { type: 'b'; value: Uint8Array }
export type OSCSomeArguments = OSCArgument | Array<OSCArgument> | OSCMetaArgument | Array<OSCMetaArgument>
