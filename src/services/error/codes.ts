/**
 * 退出码枚举
 *
 * 定义标准化的退出码，用于 CLI 程序与脚本/AI agent 的交互
 *
 * 退出码规范：
 * - 0: 成功
 * - 1: 通用错误（CLI 解析错误、参数错误等）
 * - 4: 业务错误（API 返回错误）
 * - 5: 网络错误（连接失败、超时等）
 * - 6: 鉴权错误（AK/SK 无效、token 刷新失败等）
 */
export enum ExitCode {
  /**
   * 成功
   */
  SUCCESS = 0,

  /**
   * 通用错误
   * 用于 CLI 解析错误、参数验证失败等一般性错误
   */
  GENERAL_ERROR = 1,

  /**
   * 业务错误
   * 用于 API 返回的业务错误（如资源不存在、权限不足等）
   */
  BUSINESS_ERROR = 4,

  /**
   * 网络错误
   * 用于网络连接失败、请求超时等网络相关问题
   */
  NETWORK_ERROR = 5,

  /**
   * 鉴权错误
   * 用于 AK/SK 无效、token 获取失败、token 刷新失败等鉴权相关问题
   */
  AUTH_ERROR = 6,
}

/**
 * 退出码描述映射
 */
export const ExitCodeDescriptions: Record<ExitCode, string> = {
  [ExitCode.SUCCESS]: '操作成功',
  [ExitCode.GENERAL_ERROR]: '通用错误',
  [ExitCode.BUSINESS_ERROR]: '业务错误',
  [ExitCode.NETWORK_ERROR]: '网络错误',
  [ExitCode.AUTH_ERROR]: '鉴权错误',
};

/**
 * 获取退出码的描述
 */
export function getExitCodeDescription(code: ExitCode): string {
  return ExitCodeDescriptions[code] || '未知错误';
}
