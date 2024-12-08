// Historic parsing behavior mapped variables to non-'/'-delimiter characters.
// Continue to do so even if matching something more precise would be more
// sensible.
export const Element = '[^/]+?'

export const Page = `(?<page>${Element})`
export const Location = `${Page}/(?<row>${Element})/(?<column>${Element})`

export const Bank = `(?<bank>${Element})`

export const VariableName = `(?<name>${Element})`
