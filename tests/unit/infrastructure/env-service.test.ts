/**
 * EnvService 单元测试
 */

import { EnvService } from '../../../src/infrastructure/env/env-service';
import { EnvError, EnvErrorType } from '../../../src/types/infrastructure';

describe('EnvService', () => {
  let envService: EnvService;
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    envService = new EnvService();
    // 保存原始环境变量
    originalEnv = { ...process.env };
    // 清除测试相关的环境变量
    delete process.env.YBC_TENANT_ID;
    delete process.env.YBC_APP_KEY;
    delete process.env.YBC_APP_SECRET;
    delete process.env.YBC_FORMAT;
    delete process.env.YBC_ENV;
  });

  afterEach(() => {
    // 恢复原始环境变量
    process.env = originalEnv;
  });

  describe('get', () => {
    it('应该返回环境变量值', () => {
      process.env.YBC_APP_KEY = 'test-app-key';

      const value = envService.get('YBC_APP_KEY');

      expect(value).toBe('test-app-key');
    });

    it('应该返回 undefined 当环境变量不存在', () => {
      const value = envService.get('YBC_APP_KEY');

      expect(value).toBeUndefined();
    });

    it('应该返回空字符串当环境变量为空', () => {
      process.env.YBC_APP_KEY = '';

      const value = envService.get('YBC_APP_KEY');

      expect(value).toBe('');
    });
  });

  describe('getRequired', () => {
    it('应该返回环境变量值', () => {
      process.env.YBC_APP_KEY = 'test-app-key';

      const value = envService.getRequired('YBC_APP_KEY');

      expect(value).toBe('test-app-key');
    });

    it('应该抛出 MISSING_REQUIRED 错误当环境变量不存在', () => {
      expect(() => envService.getRequired('YBC_APP_KEY')).toThrow(EnvError);

      try {
        envService.getRequired('YBC_APP_KEY');
      } catch (error) {
        expect(error).toBeInstanceOf(EnvError);
        expect((error as EnvError).type).toBe(EnvErrorType.MISSING_REQUIRED);
        expect((error as EnvError).key).toBe('YBC_APP_KEY');
      }
    });

    it('应该抛出 MISSING_REQUIRED 错误当环境变量为空字符串', () => {
      process.env.YBC_APP_KEY = '';

      expect(() => envService.getRequired('YBC_APP_KEY')).toThrow(EnvError);
    });
  });

  describe('getWithDefault', () => {
    it('应该返回环境变量值', () => {
      process.env.YBC_FORMAT = 'json';

      const value = envService.getWithDefault('YBC_FORMAT', 'table');

      expect(value).toBe('json');
    });

    it('应该返回默认值当环境变量不存在', () => {
      const value = envService.getWithDefault('YBC_FORMAT', 'table');

      expect(value).toBe('table');
    });

    it('应该返回环境变量值当值为空字符串', () => {
      process.env.YBC_FORMAT = '';

      const value = envService.getWithDefault('YBC_FORMAT', 'table');

      expect(value).toBe('');
    });
  });

  describe('validate', () => {
    it('应该返回 true 当所有环境变量有效', () => {
      process.env.YBC_TENANT_ID = 'test-tenant-id';
      process.env.YBC_APP_KEY = 'test-app-key';
      process.env.YBC_APP_SECRET = 'test-app-secret';
      process.env.YBC_FORMAT = 'json';
      process.env.YBC_ENV = 'sandbox';

      const isValid = envService.validate();

      expect(isValid).toBe(true);
    });

    it('应该返回 true 当没有设置任何环境变量', () => {
      const isValid = envService.validate();

      expect(isValid).toBe(true);
    });

    it('应该返回 false 当只设置了部分凭证', () => {
      process.env.YBC_TENANT_ID = 'test-tenant-id';
      process.env.YBC_APP_KEY = 'test-app-key';
      // 缺少 YBC_APP_SECRET

      const isValid = envService.validate();

      expect(isValid).toBe(false);
    });

    it('应该返回 false 当 YBC_FORMAT 值无效', () => {
      process.env.YBC_FORMAT = 'invalid-format';

      const isValid = envService.validate();

      expect(isValid).toBe(false);
    });

    it('应该返回 false 当 YBC_ENV 值无效', () => {
      process.env.YBC_ENV = 'invalid-env';

      const isValid = envService.validate();

      expect(isValid).toBe(false);
    });

    it('应该接受所有有效的 FORMAT 值', () => {
      const validFormats = ['json', 'table', 'csv', 'raw'];

      for (const format of validFormats) {
        process.env.YBC_FORMAT = format;
        const isValid = envService.validate();
        expect(isValid).toBe(true);
      }
    });

    it('应该接受所有有效的 ENV 值', () => {
      const validEnvs = ['sandbox', 'production'];

      for (const env of validEnvs) {
        process.env.YBC_ENV = env;
        const isValid = envService.validate();
        expect(isValid).toBe(true);
      }
    });
  });

  describe('getAll', () => {
    it('应该返回所有 YBC 环境变量', () => {
      process.env.YBC_TENANT_ID = 'test-tenant-id';
      process.env.YBC_APP_KEY = 'test-app-key';
      process.env.YBC_APP_SECRET = 'test-app-secret';
      process.env.YBC_FORMAT = 'json';
      process.env.YBC_ENV = 'production';

      const config = envService.getAll();

      expect(config).toEqual({
        YBC_TENANT_ID: 'test-tenant-id',
        YBC_APP_KEY: 'test-app-key',
        YBC_APP_SECRET: 'test-app-secret',
        YBC_FORMAT: 'json',
        YBC_ENV: 'production',
      });
    });

    it('应该返回 undefined 对于未设置的环境变量', () => {
      const config = envService.getAll();

      expect(config).toEqual({
        YBC_TENANT_ID: undefined,
        YBC_APP_KEY: undefined,
        YBC_APP_SECRET: undefined,
        YBC_FORMAT: undefined,
        YBC_ENV: undefined,
      });
    });
  });

  describe('exists', () => {
    it('应该返回 true 当环境变量存在且非空', () => {
      process.env.YBC_APP_KEY = 'test-app-key';

      const exists = envService.exists('YBC_APP_KEY');

      expect(exists).toBe(true);
    });

    it('应该返回 false 当环境变量不存在', () => {
      const exists = envService.exists('YBC_APP_KEY');

      expect(exists).toBe(false);
    });

    it('应该返回 false 当环境变量为空字符串', () => {
      process.env.YBC_APP_KEY = '';

      const exists = envService.exists('YBC_APP_KEY');

      expect(exists).toBe(false);
    });
  });

  describe('set and delete', () => {
    it('应该设置环境变量', () => {
      envService.set('YBC_APP_KEY', 'new-app-key');

      expect(process.env.YBC_APP_KEY).toBe('new-app-key');
    });

    it('应该删除环境变量', () => {
      process.env.YBC_APP_KEY = 'test-app-key';
      envService.delete('YBC_APP_KEY');

      expect(process.env.YBC_APP_KEY).toBeUndefined();
    });
  });

  describe('hasCredentials', () => {
    it('应该返回 true 当所有凭证都设置', () => {
      process.env.YBC_TENANT_ID = 'test-tenant-id';
      process.env.YBC_APP_KEY = 'test-app-key';
      process.env.YBC_APP_SECRET = 'test-app-secret';

      const hasCreds = envService.hasCredentials();

      expect(hasCreds).toBe(true);
    });

    it('应该返回 false 当只有部分凭证设置', () => {
      process.env.YBC_TENANT_ID = 'test-tenant-id';
      process.env.YBC_APP_KEY = 'test-app-key';
      // 缺少 YBC_APP_SECRET

      const hasCreds = envService.hasCredentials();

      expect(hasCreds).toBe(false);
    });

    it('应该返回 false 当都没有设置', () => {
      const hasCreds = envService.hasCredentials();

      expect(hasCreds).toBe(false);
    });

    it('应该返回 false 当值为空字符串', () => {
      process.env.YBC_TENANT_ID = '';
      process.env.YBC_APP_KEY = '';
      process.env.YBC_APP_SECRET = '';

      const hasCreds = envService.hasCredentials();

      expect(hasCreds).toBe(false);
    });
  });

  describe('getCredentials', () => {
    it('应该返回凭证对象', () => {
      process.env.YBC_TENANT_ID = 'test-tenant-id';
      process.env.YBC_APP_KEY = 'test-app-key';
      process.env.YBC_APP_SECRET = 'test-app-secret';

      const creds = envService.getCredentials();

      expect(creds).toEqual({
        tenantId: 'test-tenant-id',
        appKey: 'test-app-key',
        appSecret: 'test-app-secret',
      });
    });

    it('应该抛出错误当缺少凭证', () => {
      process.env.YBC_TENANT_ID = 'test-tenant-id';
      // 缺少 APP_KEY 和 APP_SECRET

      expect(() => envService.getCredentials()).toThrow(EnvError);
    });
  });

  describe('getFormat', () => {
    it('应该返回设置的格式', () => {
      process.env.YBC_FORMAT = 'json';

      const format = envService.getFormat();

      expect(format).toBe('json');
    });

    it('应该返回默认格式（table）当未设置', () => {
      const format = envService.getFormat();

      expect(format).toBe('table');
    });

    it('应该返回默认格式当值无效', () => {
      process.env.YBC_FORMAT = 'invalid';

      const format = envService.getFormat();

      expect(format).toBe('table');
    });

    it('应该接受所有有效格式', () => {
      const validFormats: Array<'json' | 'table' | 'csv' | 'raw'> = ['json', 'table', 'csv', 'raw'];

      for (const format of validFormats) {
        process.env.YBC_FORMAT = format;
        const result = envService.getFormat();
        expect(result).toBe(format);
      }
    });
  });

  describe('getEnv', () => {
    it('应该返回设置的环境', () => {
      process.env.YBC_ENV = 'production';

      const env = envService.getEnv();

      expect(env).toBe('production');
    });

    it('应该返回默认环境（sandbox）当未设置', () => {
      const env = envService.getEnv();

      expect(env).toBe('sandbox');
    });

    it('应该返回默认环境当值无效', () => {
      process.env.YBC_ENV = 'invalid';

      const env = envService.getEnv();

      expect(env).toBe('sandbox');
    });

    it('应该接受 production 环境', () => {
      process.env.YBC_ENV = 'production';

      const env = envService.getEnv();

      expect(env).toBe('production');
    });

    it('应该接受 sandbox 环境', () => {
      process.env.YBC_ENV = 'sandbox';

      const env = envService.getEnv();

      expect(env).toBe('sandbox');
    });
  });

  describe('integration scenarios', () => {
    it('应该支持完整的配置场景', () => {
      // 设置所有环境变量
      process.env.YBC_TENANT_ID = 'my-tenant-id';
      process.env.YBC_APP_KEY = 'my-app-key';
      process.env.YBC_APP_SECRET = 'my-app-secret';
      process.env.YBC_FORMAT = 'json';
      process.env.YBC_ENV = 'production';

      // 验证
      expect(envService.validate()).toBe(true);
      expect(envService.hasCredentials()).toBe(true);
      expect(envService.getCredentials()).toEqual({
        tenantId: 'my-tenant-id',
        appKey: 'my-app-key',
        appSecret: 'my-app-secret',
      });
      expect(envService.getFormat()).toBe('json');
      expect(envService.getEnv()).toBe('production');
    });

    it('应该支持最小配置场景', () => {
      // 没有设置任何环境变量

      // 验证
      expect(envService.validate()).toBe(true);
      expect(envService.hasCredentials()).toBe(false);
      expect(envService.getFormat()).toBe('table');
      expect(envService.getEnv()).toBe('sandbox');
    });

    it('应该支持部分配置场景', () => {
      // 只设置格式和环境
      process.env.YBC_FORMAT = 'csv';
      process.env.YBC_ENV = 'sandbox';

      // 验证
      expect(envService.validate()).toBe(true);
      expect(envService.hasCredentials()).toBe(false);
      expect(envService.getFormat()).toBe('csv');
      expect(envService.getEnv()).toBe('sandbox');
    });

    it('应该检测无效的配置组合', () => {
      // 只设置部分凭证
      process.env.YBC_TENANT_ID = 'incomplete';
      process.env.YBC_APP_KEY = 'incomplete';

      // 验证应该失败
      expect(envService.validate()).toBe(false);
      expect(envService.hasCredentials()).toBe(false);

      // 获取凭证应该抛出错误
      expect(() => envService.getCredentials()).toThrow(EnvError);
    });
  });
});
