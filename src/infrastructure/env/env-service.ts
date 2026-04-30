/**
 * 环境变量管理服务
 *
 * 提供环境变量的读取、验证和管理功能
 */

import { EnvConfig, EnvKey, EnvError, EnvErrorType } from '../../types/infrastructure';

/**
 * 环境变量服务类
 *
 * 功能：
 * - 读取环境变量
 * - 验证必需的环境变量
 * - 类型安全的访问
 * - 默认值支持
 */
export class EnvService {
  /**
   * 获取环境变量值
   * @param key 环境变量键名
   * @returns 环境变量值（未定义时返回 undefined）
   */
  get(key: EnvKey): string | undefined {
    return process.env[key];
  }

  /**
   * 获取必需的环境变量值
   * @param key 环境变量键名
   * @returns 环境变量值
   * @throws EnvError 如果环境变量不存在
   */
  getRequired(key: EnvKey): string {
    const value = this.get(key);

    if (value === undefined || value === '') {
      throw new EnvError(
        EnvErrorType.MISSING_REQUIRED,
        `Required environment variable ${key} is not set`,
        key
      );
    }

    return value;
  }

  /**
   * 获取环境变量值（带默认值）
   * @param key 环境变量键名
   * @param defaultValue 默认值
   * @returns 环境变量值或默认值
   */
  getWithDefault(key: EnvKey, defaultValue: string): string {
    return this.get(key) ?? defaultValue;
  }

  /**
   * 验证环境变量配置
   * @returns 是否所有必需的环境变量都已设置
   */
  validate(): boolean {
    // 检查凭证配置
    const hasCredentials =
      this.exists('YBC_TENANT_ID') && this.exists('YBC_APP_KEY') && this.exists('YBC_APP_SECRET');

    if (!hasCredentials) {
      // 检查是否配置了部分凭证（不完整配置）
      const hasPartialCredentials =
        this.exists('YBC_TENANT_ID') || this.exists('YBC_APP_KEY') || this.exists('YBC_APP_SECRET');

      // 如果配置了部分凭证，返回 false（不完整）
      if (hasPartialCredentials) {
        return false;
      }
    }

    // 检查 YBC_FORMAT 的有效值
    const format = this.get('YBC_FORMAT');
    if (format && !['json', 'table', 'csv', 'raw'].includes(format)) {
      return false;
    }

    // 检查 YBC_ENV 的有效值
    const env = this.get('YBC_ENV');
    if (env && !['sandbox', 'production'].includes(env)) {
      return false;
    }

    return true;
  }

  /**
   * 获取所有 YBC 相关的环境变量
   * @returns 环境变量配置对象
   */
  getAll(): EnvConfig {
    return {
      YBC_TENANT_ID: this.get('YBC_TENANT_ID'),
      YBC_APP_KEY: this.get('YBC_APP_KEY'),
      YBC_APP_SECRET: this.get('YBC_APP_SECRET'),
      YBC_FORMAT: this.get('YBC_FORMAT') as EnvConfig['YBC_FORMAT'],
      YBC_ENV: this.get('YBC_ENV') as EnvConfig['YBC_ENV'],
    };
  }

  /**
   * 检查环境变量是否存在
   * @param key 环境变量键名
   * @returns 是否存在
   */
  exists(key: EnvKey): boolean {
    const value = this.get(key);
    return value !== undefined && value !== '';
  }

  /**
   * 设置环境变量（仅在当前进程中）
   * @param key 环境变量键名
   * @param value 环境变量值
   */
  set(key: EnvKey, value: string): void {
    process.env[key] = value;
  }

  /**
   * 删除环境变量（仅在当前进程中）
   * @param key 环境变量键名
   */
  delete(key: EnvKey): void {
    delete process.env[key];
  }

  /**
   * 检查是否配置了凭证
   * @returns 是否配置了凭证
   */
  hasCredentials(): boolean {
    return this.exists('YBC_TENANT_ID') && this.exists('YBC_APP_KEY') && this.exists('YBC_APP_SECRET');
  }

  /**
   * 获取凭证
   * @returns 凭证对象
   * @throws EnvError 如果凭证不完整
   */
  getCredentials(): { tenantId: string; appKey: string; appSecret: string } {
    const tenantId = this.get('YBC_TENANT_ID');
    const appKey = this.get('YBC_APP_KEY');
    const appSecret = this.get('YBC_APP_SECRET');

    if (tenantId && appKey && appSecret) {
      return { tenantId, appKey, appSecret };
    }

    throw new EnvError(
      EnvErrorType.MISSING_REQUIRED,
      'Credentials are incomplete. Please set YBC_TENANT_ID, YBC_APP_KEY, YBC_APP_SECRET',
      'CREDENTIALS'
    );
  }

  /**
   * 获取输出格式
   * @returns 输出格式（默认 'table'）
   */
  getFormat(): 'json' | 'table' | 'csv' | 'raw' {
    const format = this.get('YBC_FORMAT');
    if (format && ['json', 'table', 'csv', 'raw'].includes(format)) {
      return format as 'json' | 'table' | 'csv' | 'raw';
    }
    return 'table'; // 默认值
  }

  /**
   * 获取环境
   * @returns 环境名称（默认 'sandbox'）
   */
  getEnv(): 'sandbox' | 'production' {
    const env = this.get('YBC_ENV');
    if (env === 'production') {
      return 'production';
    }
    return 'sandbox'; // 默认值
  }
}
