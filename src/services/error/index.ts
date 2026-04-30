/**
 * 错误处理模块
 *
 * 提供统一的错误处理机制和标准化的退出码
 */

export { ExitCode, ExitCodeDescriptions, getExitCodeDescription } from './codes';
export {
  CliError,
  AuthError,
  NetworkError,
  BusinessError,
  ValidationError,
  isCliError,
  isAuthError,
  isNetworkError,
  isBusinessError,
  isValidationError,
} from './errors';
export {
  ErrorHandler,
  ErrorHandlerConfig,
  errorHandler,
  setupGlobalErrorHandler,
  handleErrorAndExit,
} from './error-handler';
