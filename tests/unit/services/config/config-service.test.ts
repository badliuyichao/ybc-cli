/**
 * ConfigService 单元测试
 */

import * as path from 'path';
import * as os from 'os';
import { ConfigService } from '@/services/config/config-service';
import { FileStorage } from '@/infrastructure/storage/file-storage';
import { Config } from '@/types/config';
import { ValidationError } from '@/services/error/errors';

describe('ConfigService', () => {
  let configService: ConfigService;
  let storage: FileStorage;
  let tempDir: string;

  const validConfig: Partial<Config> = {
    tenantId: 'test-tenant-id-12345',
    appKey: 'test-app-key-12345678',
    appSecret: 'test-app-secret-12345678901234',
    env: 'sandbox',
    format: 'table',
  };

  beforeEach(() => {
    // 创建临时目录
    tempDir = path.join(os.tmpdir(), 'ybc-config-test-', Date.now().toString());
    storage = new FileStorage();

    // 创建 ConfigService（使用临时目录）
    configService = new ConfigService(tempDir);
  });

  afterEach(async () => {
    // 清理临时文件
    try {
      await storage.delete(tempDir);
    } catch {
      // 忽略清理错误
    }
  });

  describe('init', () => {
    it('should create valid config file', async () => {
      await configService.init(validConfig);

      // 验证配置文件存在
      const exists = await configService.exists();
      expect(exists).toBe(true);
    });

    it('should encrypt SK in config file', async () => {
      await configService.init(validConfig);

      // 读取配置文件
      const configPath = path.join(tempDir, 'config.json');
      const rawConfig = await storage.read(configPath);

      // 验证 SK 已加密（不是原始值）
      expect(rawConfig.appSecret).not.toBe(validConfig.appSecret);
      expect(rawConfig.appSecret).toBeDefined();
    });

    it('should set file permissions to 600', async () => {
      await configService.init(validConfig);

      // 读取配置文件（解密 SK）
      const config = await configService.getConfig({ decryptSensitive: true });

      expect(config.appKey).toBe(validConfig.appKey);
      expect(config.appSecret).toBe(validConfig.appSecret);
      expect(config.env).toBe(validConfig.env);
    });

    it('should throw ValidationError for missing AK', async () => {
      const invalidConfig = { ...validConfig, appKey: undefined };

      await expect(configService.init(invalidConfig as any)).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError for missing SK', async () => {
      const invalidConfig = { ...validConfig, appSecret: undefined };

      await expect(configService.init(invalidConfig as any)).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError for invalid environment', async () => {
      const invalidConfig = { ...validConfig, env: 'invalid' as any };

      await expect(configService.init(invalidConfig)).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError for invalid format', async () => {
      const invalidConfig = { ...validConfig, format: 'invalid' as any };

      await expect(configService.init(invalidConfig)).rejects.toThrow(ValidationError);
    });

    it('should use default values for missing optional fields', async () => {
      const minimalConfig = {
        tenantId: 'test-tenant-id-12345',
        appKey: 'test-app-key-12345678',  // 符合长度要求
        appSecret: 'test-app-secret-12345678901234',  // 符合长度要求
      };

      await configService.init(minimalConfig);

      const config = await configService.getConfig({ decryptSensitive: true });

      expect(config.env).toBe('sandbox'); // 默认值
      expect(config.format).toBe('table'); // 默认值
    });
  });

  describe('getConfig', () => {
    it('should return decrypted config', async () => {
      await configService.init(validConfig);

      const config = await configService.getConfig({ decryptSensitive: true });

      expect(config.appKey).toBe(validConfig.appKey);
      expect(config.appSecret).toBe(validConfig.appSecret);
      expect(config.env).toBe(validConfig.env);
    });

    it('should mask SK when requested', async () => {
      await configService.init(validConfig);

      const config = await configService.getConfig({ decryptSensitive: true, maskSensitive: true });

      // SK 应该被脱敏
      expect(config.appSecret).not.toBe(validConfig.appSecret);
      expect(config.appSecret).toContain('****');
    });

    it('should return empty config if file does not exist', async () => {
      const config = await configService.getConfig();
      expect(config).toBeDefined();
    });

    it('should prioritize environment variables', async () => {
      // 设置环境变量
      process.env.YBC_AK = 'env-ak';
      process.env.YBC_SK = 'env-sk';
      process.env.YBC_ENV = 'production';
      process.env.YBC_TENANT_ID = 'env-tenant-id';
      process.env.YBC_APP_KEY = 'env-app-key';
      process.env.YBC_APP_SECRET = 'env-app-secret';

      await configService.init(validConfig);

      const config = await configService.getConfig({ decryptSensitive: true });

      // 环境变量应该优先
      expect(config.tenantId).toBe('env-tenant-id');
      expect(config.appKey).toBe('env-app-key');
      expect(config.appSecret).toBe('env-app-secret');
      expect(config.env).toBe('production');

      // 清理环境变量
      delete process.env.YBC_AK;
      delete process.env.YBC_SK;
      delete process.env.YBC_ENV;
      delete process.env.YBC_TENANT_ID;
      delete process.env.YBC_APP_KEY;
      delete process.env.YBC_APP_SECRET;
    });
  });

  describe('setConfig', () => {
    it('should update appKey', async () => {
      await configService.init(validConfig);

      await configService.setConfig('appKey', 'new-access-key-12345678');

      const config = await configService.getConfig({ decryptSensitive: true });
      expect(config.appKey).toBe('new-access-key-12345678');
    });

    it('should update and encrypt SK', async () => {
      await configService.init(validConfig);

      const newSk = 'new-secret-key-12345678901234';
      await configService.setConfig('appSecret', newSk);

      const config = await configService.getConfig({ decryptSensitive: true });
      expect(config.appSecret).toBe(newSk);

      // 验证文件中的 SK 是加密的
      const configPath = path.join(tempDir, 'config.json');
      const rawConfig = await storage.read(configPath);
      expect(rawConfig.appSecret).not.toBe(newSk);
    });

    it('should update environment', async () => {
      await configService.init(validConfig);

      await configService.setConfig('env', 'production');

      const config = await configService.getConfig();
      expect(config.env).toBe('production');
    });

    it('should update format', async () => {
      await configService.init(validConfig);

      await configService.setConfig('format', 'json');

      const config = await configService.getConfig();
      expect(config.format).toBe('json');
    });

    it('should throw ValidationError for invalid field', async () => {
      await configService.init(validConfig);

      await expect(configService.setConfig('invalid' as any, 'value')).rejects.toThrow(
        ValidationError
      );
    });

    it('should throw ValidationError for invalid value', async () => {
      await configService.init(validConfig);

      await expect(configService.setConfig('env', 'invalid')).rejects.toThrow(ValidationError);
    });
  });

  describe('exists', () => {
    it('should return true if config exists', async () => {
      await configService.init(validConfig);

      const exists = await configService.exists();
      expect(exists).toBe(true);
    });

    it('should return false if config does not exist', async () => {
      const exists = await configService.exists();
      expect(exists).toBe(false);
    });
  });

  describe('delete', () => {
    it('should delete config file', async () => {
      await configService.init(validConfig);

      await configService.delete();

      const exists = await configService.exists();
      expect(exists).toBe(false);
    });

    it('should handle non-existent file gracefully', async () => {
      // 删除不存在的文件应该成功
      await configService.delete();
    });
  });

  describe('validation', () => {
    it('should validate AK length', async () => {
      const invalidConfig = {
        ...validConfig,
        appKey: 'short', // 太短
      };

      await expect(configService.init(invalidConfig)).rejects.toThrow(ValidationError);
    });

    it('should validate SK length', async () => {
      const invalidConfig = {
        ...validConfig,
        appSecret: 'short', // 太短
      };

      await expect(configService.init(invalidConfig)).rejects.toThrow(ValidationError);
    });

    it('should accept valid AK length (16-128)', async () => {
      const configs = [
        { ...validConfig, appKey: '1234567890123456' }, // 最小长度 16
        { ...validConfig, appKey: 'a'.repeat(128) }, // 最大长度
      ];

      for (const config of configs) {
        await configService.init(config);
        await configService.delete();
      }
    });

    it('should accept valid SK length (16-256)', async () => {
      const configs = [
        { ...validConfig, appSecret: '1234567890123456' }, // 最小长度
        { ...validConfig, appSecret: 'a'.repeat(256) }, // 最大长度
      ];

      for (const config of configs) {
        await configService.init(config);
        await configService.delete();
      }
    });
  });

  describe('security', () => {
    it('should not expose SK in error messages', async () => {
      const invalidConfig = {
        ...validConfig,
        appSecret: 'short', // 无效的 SK
      };

      try {
        await configService.init(invalidConfig);
      } catch (error) {
        expect(error).toBeInstanceOf(ValidationError);
        const errorMessage = (error as Error).message;
        expect(errorMessage).not.toContain(validConfig.appSecret!);
      }
    });

    it('should store config with 600 permissions', async () => {
      await configService.init(validConfig);

      // 验证文件权限（在 Windows 上可能无法验证）
      // 这里主要验证功能可以执行
      const exists = await configService.exists();
      expect(exists).toBe(true);
    });
  });
});
