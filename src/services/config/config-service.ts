/**
 * 配置管理服务
 *
 * 负责管理 CLI 配置，包括读取、写入、验证和加密
 */

import * as os from 'os';
import * as path from 'path';
import { FileStorage } from '../../infrastructure/storage/file-storage';
import { EncryptionService } from '../../infrastructure/crypto/encryption-service';
import { EnvService } from '../../infrastructure/env/env-service';
import { ValidationError } from '../error/errors';
import {
  Config,
  ConfigField,
  ConfigUpdateOptions,
  ConfigQueryOptions,
  Environment,
  OutputFormat,
} from '../../types/config';

/**
 * 配置服务类
 *
 * 功能：
 * - 管理配置文件 (~/.ybc/config.json)
 * - 加密敏感字段 (SK)
 * - 支持环境变量覆盖
 * - 配置验证
 */
export class ConfigService {
  private readonly configDir: string;
  private readonly configFilePath: string;
  private readonly storage: FileStorage;
  private readonly encryption: EncryptionService;
  private readonly envService: EnvService;

  /**
   * 构造函数
   * @param configDir 配置目录路径（默认 ~/.ybc）
   */
  constructor(configDir?: string) {
    this.configDir = configDir || path.join(os.homedir(), '.ybc');
    this.configFilePath = path.join(this.configDir, 'config.json');
    this.storage = new FileStorage();
    this.encryption = new EncryptionService(this.storage);
    this.envService = new EnvService();
  }

  /**
   * 初始化配置
   * 引导用户创建配置文件
   */
  async init(config: Partial<Config>): Promise<void> {
    // 验证必需字段
    if (!config.tenantId) {
      throw new ValidationError('Tenant ID (tenantId) is required', {
        field: 'tenantId',
      });
    }

    if (!config.appKey) {
      throw new ValidationError('App Key (appKey) is required', {
        field: 'appKey',
      });
    }

    if (!config.appSecret) {
      throw new ValidationError('App Secret (appSecret) is required', {
        field: 'appSecret',
      });
    }

    // 验证 tenantId 格式
    this.validateTenantId(config.tenantId);

    // 验证 appKey 格式
    this.validateAppKey(config.appKey);

    // 验证 appSecret 格式
    this.validateAppSecret(config.appSecret);

    // 验证环境
    if (config.env && !this.isValidEnvironment(config.env)) {
      throw new ValidationError(
        `Invalid environment: ${config.env}. Must be "sandbox" or "production"`,
        {
          field: 'env',
          value: config.env,
        }
      );
    }

    // 验证输出格式
    if (config.format && !this.isValidOutputFormat(config.format)) {
      throw new ValidationError(
        `Invalid output format: ${config.format}. Must be "json", "table", "csv", or "raw"`,
        {
          field: 'format',
          value: config.format,
        }
      );
    }

    // 加密 appSecret
    const encryptedSecret = await this.encryption.encrypt(config.appSecret);

    // 创建配置对象
    const fullConfig: Config = {
      tenantId: config.tenantId,
      appKey: config.appKey,
      appSecret: encryptedSecret,
      env: config.env || 'sandbox',
      format: config.format || 'table',
      version: '2.0',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // 保存配置
    await this.storage.write(this.configFilePath, fullConfig, {
      mode: 0o600, // 仅所有者可读写
    });
  }

  /**
   * 读取配置
   * @param options 查询选项
   * @returns 配置对象
   */
  async getConfig(options?: ConfigQueryOptions): Promise<Config> {
    // 优先从环境变量读取
    const envConfig = this.loadFromEnv();

    // 如果环境变量中存在完整配置，直接返回
    if (envConfig.tenantId && envConfig.appKey && envConfig.appSecret) {
      return {
        ...envConfig,
        env: envConfig.env || 'sandbox',
        format: envConfig.format || 'table',
      };
    }

    // 从文件读取
    try {
      const config = await this.storage.read(this.configFilePath);

      // 向后兼容：支持旧字段名 ak/sk
      const appKey = config.appKey;
      const appSecret = config.appSecret;

      // 合并环境变量（环境变量优先）
      const mergedConfig = {
        ...config,
        tenantId: envConfig.tenantId || config.tenantId,
        appKey: envConfig.appKey || appKey,
        appSecret: envConfig.appSecret || appSecret,
        ...envConfig,
      };

      // 解密 appSecret（如果需要）
      if (options?.decryptSensitive !== false && mergedConfig.appSecret) {
        try {
          mergedConfig.appSecret = await this.encryption.decrypt(mergedConfig.appSecret);
        } catch (error) {
          // 解密失败，可能是未加密的旧数据
          // 保持原样
        }
      }

      // 脱敏 appSecret（如果需要）
      if (options?.maskSensitive && mergedConfig.appSecret) {
        mergedConfig.appSecret = this.maskAppSecret(mergedConfig.appSecret);
      }

      return mergedConfig;
    } catch (error) {
      // 配置文件不存在
      if (envConfig.tenantId || envConfig.appKey || envConfig.appSecret) {
        // 环境变量中有部分配置
        return {
          ...envConfig,
          env: envConfig.env || 'sandbox',
          format: envConfig.format || 'table',
        };
      }

      // 返回空配置
      return {};
    }
  }

  /**
   * 更新配置
   * @param field 字段名
   * @param value 字段值
   * @param options 更新选项
   */
  async setConfig(field: ConfigField, value: string, options?: ConfigUpdateOptions): Promise<void> {
    // 验证字段名
    const validFields: ConfigField[] = ['tenantId', 'appKey', 'appSecret', 'env', 'format'];
    if (!validFields.includes(field)) {
      throw new ValidationError(
        `Invalid config field: ${field}. Valid fields are: ${validFields.join(', ')}`,
        { field, value }
      );
    }

    // 验证值
    if (options?.validate !== false) {
      this.validateField(field, value);
    }

    // 读取现有配置
    let config: Config = {};
    try {
      config = await this.storage.read(this.configFilePath);
    } catch {
      // 配置文件不存在，创建新的
    }

    // 加密敏感字段
    let processedValue = value;
    if (field === 'appSecret' && options?.encryptSensitive !== false) {
      processedValue = await this.encryption.encrypt(value);
    }

    // 更新配置
    config[field] = processedValue as any;
    config.updatedAt = new Date().toISOString();

    // 保存配置
    await this.storage.write(this.configFilePath, config, {
      mode: 0o600,
    });
  }

  /**
   * 检查配置是否存在
   */
  async exists(): Promise<boolean> {
    return await this.storage.exists(this.configFilePath);
  }

  /**
   * 删除配置文件
   */
  async delete(): Promise<void> {
    if (await this.exists()) {
      await this.storage.delete(this.configFilePath);
    }
  }

  /**
   * 从环境变量加载配置
   */
  private loadFromEnv(): Partial<Config> {
    const config: Partial<Config> = {};

    const tenantId = this.envService.get('YBC_TENANT_ID');
    const appKey = this.envService.get('YBC_APP_KEY');
    const appSecret = this.envService.get('YBC_APP_SECRET');
    const format = this.envService.get('YBC_FORMAT') as OutputFormat | undefined;
    const env = this.envService.get('YBC_ENV') as Environment | undefined;

    if (tenantId) config.tenantId = tenantId;
    if (appKey) config.appKey = appKey;
    if (appSecret) config.appSecret = appSecret;

    if (format && this.isValidOutputFormat(format)) config.format = format;
    if (env && this.isValidEnvironment(env)) config.env = env;

    return config;
  }

  /**
   * 验证字段值
   */
  private validateField(field: ConfigField, value: string): void {
    switch (field) {
      case 'tenantId':
        this.validateTenantId(value);
        break;
      case 'appKey':
        this.validateAppKey(value);
        break;
      case 'appSecret':
        this.validateAppSecret(value);
        break;
      case 'env':
        if (!this.isValidEnvironment(value as Environment)) {
          throw new ValidationError(
            `Invalid environment: ${value}. Must be "sandbox" or "production"`,
            { field, value }
          );
        }
        break;
      case 'format':
        if (!this.isValidOutputFormat(value as OutputFormat)) {
          throw new ValidationError(
            `Invalid output format: ${value}. Must be "json", "table", "csv", or "raw"`,
            { field, value }
          );
        }
        break;
    }
  }

  /**
   * 验证 tenantId 格式
   */
  private validateTenantId(tenantId: string): void {
    if (!tenantId || tenantId.trim().length === 0) {
      throw new ValidationError('Tenant ID cannot be empty', { field: 'tenantId', value: tenantId });
    }
  }

  /**
   * 验证 appKey 格式
   */
  private validateAppKey(appKey: string): void {
    if (!appKey || appKey.trim().length === 0) {
      throw new ValidationError('App Key cannot be empty', { field: 'appKey', value: appKey });
    }

    if (appKey.length < 16 || appKey.length > 128) {
      throw new ValidationError('App Key must be between 16 and 128 characters', {
        field: 'appKey',
        value: appKey,
      });
    }
  }

  /**
   * 验证 appSecret 格式
   */
  private validateAppSecret(appSecret: string): void {
    if (!appSecret || appSecret.trim().length === 0) {
      throw new ValidationError('App Secret cannot be empty', { field: 'appSecret', value: appSecret });
    }

    if (appSecret.length < 16 || appSecret.length > 256) {
      throw new ValidationError('App Secret must be between 16 and 256 characters', {
        field: 'appSecret',
        value: appSecret,
      });
    }
  }

  /**
   * 检查是否为有效的环境值
   */
  private isValidEnvironment(env: string): env is Environment {
    return env === 'sandbox' || env === 'production';
  }

  /**
   * 检查是否为有效的输出格式
   */
  private isValidOutputFormat(format: string): format is OutputFormat {
    return ['json', 'table', 'csv', 'raw'].includes(format);
  }

  /**
   * 脱敏 appSecret
   */
  private maskAppSecret(appSecret: string): string {
    if (appSecret.length <= 8) {
      return '****';
    }
    return appSecret.substring(0, 4) + '****' + appSecret.substring(appSecret.length - 4);
  }

  /**
   * 获取配置文件路径
   */
  getConfigFilePath(): string {
    return this.configFilePath;
  }

  /**
   * 获取配置目录路径
   */
  getConfigDir(): string {
    return this.configDir;
  }
}
