/**
 * config show 命令 E2E 测试
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { execSync } from 'child_process';

describe('config show command (E2E)', () => {
  const tempDir = path.join(os.tmpdir(), 'ybc-test-' + Date.now());
  const configPath = path.join(tempDir, '.ybc', 'config.json');

  beforeAll(() => {
    fs.mkdirSync(tempDir, { recursive: true });
  });

  afterAll(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  beforeEach(() => {
    const configDir = path.dirname(configPath);
    if (fs.existsSync(configDir)) {
      fs.rmSync(configDir, { recursive: true, force: true });
    }
  });

  describe('配置文件存在', () => {
    it('应该显示配置（App Secret 脱敏）', () => {
      const tenantId = 'test-tenant-12345';
      const appKey = 'test-app-key-12345678';
      const appSecret = 'test-app-secret-1234567890123456';

      const testEnv = { ...process.env, HOME: tempDir, USERPROFILE: tempDir };


      try {
        // 初始化配置
        execSync(
          `npx ts-node src/bin/ybc.ts config init --non-interactive --tenant-id "${tenantId}" --app-key "${appKey}" --app-secret "${appSecret}"`,
          {
            encoding: 'utf-8',
            cwd: process.cwd(),
            env: testEnv,
          }
        );

        // 显示配置
        const result = execSync('npx ts-node src/bin/ybc.ts config show', {
          encoding: 'utf-8',
          cwd: process.cwd(),
          env: testEnv,
        });

        expect(result).toContain('当前配置');
        expect(result).toContain('租户ID');
        expect(result).toContain(tenantId);
        expect(result).toContain('App Key');
        expect(result).toContain(appKey);
        expect(result).toContain('App Secret');
        expect(result).toContain('****'); // App Secret 已脱敏
        expect(result).not.toContain(appSecret); // 完整 App Secret 不应显示
        expect(result).toContain('环境');
        expect(result).toContain('sandbox');
        expect(result).toContain('输出格式');
        expect(result).toContain('table');
      } finally {
        // 清理
      }
    });

    it('应该显示完整 App Secret（使用 --reveal）', () => {
      const tenantId = 'test-tenant-12345';
      const appKey = 'test-app-key-12345678';
      const appSecret = 'test-app-secret-1234567890123456';

      const testEnv = { ...process.env, HOME: tempDir, USERPROFILE: tempDir };


      try {
        // 初始化配置
        execSync(
          `npx ts-node src/bin/ybc.ts config init --non-interactive --tenant-id "${tenantId}" --app-key "${appKey}" --app-secret "${appSecret}"`,
          {
            encoding: 'utf-8',
            cwd: process.cwd(),
            env: testEnv,
          }
        );

        // 显示配置（reveal）
        const result = execSync('npx ts-node src/bin/ybc.ts config show --reveal', {
          encoding: 'utf-8',
          cwd: process.cwd(),
          env: testEnv,
        });

        expect(result).toContain('App Secret');
        expect(result).toContain(appSecret); // 完整 App Secret 应显示
        expect(result).toContain('警告');
      } finally {
        // 清理
      }
    });

    it('应该以 JSON 格式输出（使用 --json）', () => {
      const tenantId = 'test-tenant-12345';
      const appKey = 'test-app-key-12345678';
      const appSecret = 'test-app-secret-1234567890123456';

      const testEnv = { ...process.env, HOME: tempDir, USERPROFILE: tempDir };


      try {
        // 初始化配置
        execSync(
          `npx ts-node src/bin/ybc.ts config init --non-interactive --tenant-id "${tenantId}" --app-key "${appKey}" --app-secret "${appSecret}"`,
          {
            encoding: 'utf-8',
            cwd: process.cwd(),
            env: testEnv,
          }
        );

        // 显示配置（JSON）
        const result = execSync('npx ts-node src/bin/ybc.ts config show --json', {
          encoding: 'utf-8',
          cwd: process.cwd(),
          env: testEnv,
        });

        // 验证 JSON 格式
        const config = JSON.parse(result);
        expect(config.tenantId).toBe(tenantId);
        expect(config.appKey).toBe(appKey);
        expect(config.appSecret).toBeDefined();
        expect(config.env).toBe('sandbox');
        expect(config.format).toBe('table');
      } finally {
        // 清理
      }
    });
  });

  describe('配置文件不存在', () => {
    it('应该提示未配置', () => {
      const testEnv = { ...process.env, HOME: tempDir, USERPROFILE: tempDir };
      

      try {
        expect(() => {
          execSync('npx ts-node src/bin/ybc.ts config show', {
            encoding: 'utf-8',
            cwd: process.cwd(),
            env: testEnv,
          });
        }).toThrow();
      } finally {
        // 清理
      }
    });
  });

  describe('环境变量配置', () => {
    it('应该显示环境变量中的配置（优先级高于文件）', () => {
      const tenantId = 'test-tenant-12345';
      const appKey = 'test-app-key-12345678';
      const appSecret = 'test-app-secret-1234567890123456';

      const envTenantId = 'env-tenant-12345';
      const envAppKey = 'env-app-key-12345678';
      const envAppSecret = 'env-app-secret-1234567890123456';

      const testEnv = { ...process.env, HOME: tempDir, USERPROFILE: tempDir };


      try {
        // 初始化文件配置
        execSync(
          `npx ts-node src/bin/ybc.ts config init --non-interactive --tenant-id "${tenantId}" --app-key "${appKey}" --app-secret "${appSecret}"`,
          {
            encoding: 'utf-8',
            cwd: process.cwd(),
            env: testEnv,
          }
        );

        // 设置环境变量
        const env = {
          ...process.env,
          YBC_TENANT_ID: envTenantId,
          YBC_APP_KEY: envAppKey,
          YBC_APP_SECRET: envAppSecret,
        };

        // 显示配置
        const result = execSync('npx ts-node src/bin/ybc.ts config show', {
          encoding: 'utf-8',
          cwd: process.cwd(),
          env,
        });

        // 环境变量配置应优先
        expect(result).toContain(envTenantId);
        expect(result).toContain(envAppKey);
      } finally {
        // 清理
      }
    });
  });
});
