/**
 * config init 命令 E2E 测试
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { execSync } from 'child_process';

describe('config init command (E2E)', () => {
  const tempDir = path.join(os.tmpdir(), 'ybc-test-' + Date.now());
  const configPath = path.join(tempDir, '.ybc', 'config.json');

  beforeAll(() => {
    // 创建临时目录
    fs.mkdirSync(tempDir, { recursive: true });
  });

  afterAll(() => {
    // 清理临时目录
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  beforeEach(() => {
    // 清理配置文件
    const configDir = path.dirname(configPath);
    if (fs.existsSync(configDir)) {
      fs.rmSync(configDir, { recursive: true, force: true });
    }
  });

  describe('非交互模式', () => {
    it('应该成功初始化配置（完整参数）', () => {
      const tenantId = 'test-tenant-12345';
      const appKey = 'test-app-key-12345678';
      const appSecret = 'test-app-secret-1234567890123456';
      const env = 'sandbox';
      const format = 'table';

      // 设置临时 HOME 目录
      const testEnv = {
        ...process.env,
        HOME: tempDir,
        USERPROFILE: tempDir, // Windows
      };

      try {
        // 运行 init 命令（非交互模式）
        const result = execSync(
          `npx ts-node src/bin/ybc.ts config init --non-interactive --tenant-id "${tenantId}" --app-key "${appKey}" --app-secret "${appSecret}" --env "${env}" --format "${format}"`,
          {
            encoding: 'utf-8',
            cwd: process.cwd(),
            env: testEnv,
          }
        );

        // 验证输出
        expect(result).toContain('配置初始化成功');
        expect(result).toContain('租户ID: test-tenant-12345');
        expect(result).toContain('App Key: test-app****');
        expect(result).toContain('环境: sandbox');
        expect(result).toContain('输出格式: table');
        expect(result).toContain('App Secret 已加密存储');

        // 验证配置文件
        expect(fs.existsSync(configPath)).toBe(true);

        // 验证文件权限（仅 Unix）
        if (process.platform !== 'win32') {
          const stats = fs.statSync(configPath);
          const mode = stats.mode & 0o777;
          expect(mode).toBe(0o600);
        }

        // 验证配置内容
        const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        expect(config.tenantId).toBe(tenantId);
        expect(config.appKey).toBe(appKey);
        expect(config.appSecret).toBeDefined(); // App Secret 已加密
        expect(config.env).toBe(env);
        expect(config.format).toBe(format);
        expect(config.version).toBeDefined();
        expect(config.createdAt).toBeDefined();
        expect(config.updatedAt).toBeDefined();
      } finally {
        // 清理（不需要恢复，因为没有修改 process.env）
      }
    });

    it('应该成功初始化配置（默认值）', () => {
      const tenantId = 'test-tenant-12345';
      const appKey = 'test-app-key-12345678';
      const appSecret = 'test-app-secret-1234567890123456';

      const testEnv = {
        ...process.env,
        HOME: tempDir,
        USERPROFILE: tempDir, // Windows
      };

      try {
        const result = execSync(
          `npx ts-node src/bin/ybc.ts config init --non-interactive --tenant-id "${tenantId}" --app-key "${appKey}" --app-secret "${appSecret}"`,
          {
            encoding: 'utf-8',
            cwd: process.cwd(),
            env: testEnv,
          }
        );

        expect(result).toContain('环境: sandbox');
        expect(result).toContain('输出格式: table');

        // 验证配置
        const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        expect(config.env).toBe('sandbox');
        expect(config.format).toBe('table');
      } finally {
        // 清理
      }
    });

    it('应该拒绝空的 Tenant ID', () => {
      const appKey = 'test-app-key-12345678';
      const appSecret = 'test-app-secret-1234567890123456';

      const testEnv = {
        ...process.env,
        HOME: tempDir,
        USERPROFILE: tempDir, // Windows
      };

      try {
        expect(() => {
          execSync(
            `npx ts-node src/bin/ybc.ts config init --non-interactive --tenant-id "" --app-key "${appKey}" --app-secret "${appSecret}"`,
            {
              encoding: 'utf-8',
              cwd: process.cwd(),
              env: testEnv,
            }
          );
        }).toThrow();

        // 配置文件不应存在
        expect(fs.existsSync(configPath)).toBe(false);
      } finally {
        // 清理
      }
    });

    it('应该拒绝过短的 App Key', () => {
      const tenantId = 'test-tenant-12345';
      const appKey = 'short';
      const appSecret = 'test-app-secret-1234567890123456';

      const testEnv = {
        ...process.env,
        HOME: tempDir,
        USERPROFILE: tempDir, // Windows
      };

      try {
        expect(() => {
          execSync(
            `npx ts-node src/bin/ybc.ts config init --non-interactive --tenant-id "${tenantId}" --app-key "${appKey}" --app-secret "${appSecret}"`,
            {
              encoding: 'utf-8',
              cwd: process.cwd(),
              env: testEnv,
            }
          );
        }).toThrow();

        expect(fs.existsSync(configPath)).toBe(false);
      } finally {
        // 清理
      }
    });

    it('应该拒绝过短的 App Secret', () => {
      const tenantId = 'test-tenant-12345';
      const appKey = 'test-app-key-12345678';
      const appSecret = 'short';

      const testEnv = {
        ...process.env,
        HOME: tempDir,
        USERPROFILE: tempDir, // Windows
      };

      try {
        expect(() => {
          execSync(
            `npx ts-node src/bin/ybc.ts config init --non-interactive --tenant-id "${tenantId}" --app-key "${appKey}" --app-secret "${appSecret}"`,
            {
              encoding: 'utf-8',
              cwd: process.cwd(),
              env: testEnv,
            }
          );
        }).toThrow();

        expect(fs.existsSync(configPath)).toBe(false);
      } finally {
        // 清理
      }
    });

    it('应该拒绝无效的环境值', () => {
      const tenantId = 'test-tenant-12345';
      const appKey = 'test-app-key-12345678';
      const appSecret = 'test-app-secret-1234567890123456';
      const env = 'invalid_env';

      const testEnv = {
        ...process.env,
        HOME: tempDir,
        USERPROFILE: tempDir, // Windows
      };

      try {
        expect(() => {
          execSync(
            `npx ts-node src/bin/ybc.ts config init --non-interactive --tenant-id "${tenantId}" --app-key "${appKey}" --app-secret "${appSecret}" --env "${env}"`,
            {
              encoding: 'utf-8',
              cwd: process.cwd(),
              env: process.env,
            }
          );
        }).toThrow();

        expect(fs.existsSync(configPath)).toBe(false);
      } finally {
        // 清理
      }
    });

    it('应该拒绝无效的输出格式', () => {
      const tenantId = 'test-tenant-12345';
      const appKey = 'test-app-key-12345678';
      const appSecret = 'test-app-secret-1234567890123456';
      const format = 'invalid_format';

      const testEnv = {
        ...process.env,
        HOME: tempDir,
        USERPROFILE: tempDir, // Windows
      };

      try {
        expect(() => {
          execSync(
            `npx ts-node src/bin/ybc.ts config init --non-interactive --tenant-id "${tenantId}" --app-key "${appKey}" --app-secret "${appSecret}" --format "${format}"`,
            {
              encoding: 'utf-8',
              cwd: process.cwd(),
              env: process.env,
            }
          );
        }).toThrow();

        expect(fs.existsSync(configPath)).toBe(false);
      } finally {
        // 清理
      }
    });

    it('应该拒绝重复初始化', () => {
      const tenantId = 'test-tenant-12345';
      const appKey = 'test-app-key-12345678';
      const appSecret = 'test-app-secret-1234567890123456';

      const testEnv = {
        ...process.env,
        HOME: tempDir,
        USERPROFILE: tempDir, // Windows
      };

      try {
        // 第一次初始化
        execSync(
          `npx ts-node src/bin/ybc.ts config init --non-interactive --tenant-id "${tenantId}" --app-key "${appKey}" --app-secret "${appSecret}"`,
          {
            encoding: 'utf-8',
            cwd: process.cwd(),
            env: testEnv,
          }
        );

        expect(fs.existsSync(configPath)).toBe(true);

        // 第二次初始化应该失败
        expect(() => {
          execSync(
            `npx ts-node src/bin/ybc.ts config init --non-interactive --tenant-id "${tenantId}" --app-key "${appKey}" --app-secret "${appSecret}"`,
            {
              encoding: 'utf-8',
              cwd: process.cwd(),
              env: testEnv,
            }
          );
        }).toThrow();
      } finally {
        // 清理
      }
    });
  });
});
