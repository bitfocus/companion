// Always disable the utf-8-validate module, it is not needed since nodejs v18.14.0
process.env.WS_NO_UTF_8_VALIDATE = '1'

/**
 * Danger: This file must not import other code, as it needs to run before `ws` is imported
 * making it unsafe to import any other code
 */
