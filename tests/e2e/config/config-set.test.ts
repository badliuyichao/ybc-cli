/**
 * config set 命令 E2E 测试
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { execSync } from 'child_process';

describe('config set command (E2E)', () => {
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

  describe('修改配置项', () => {
    it('应该成功修改 Tenant ID', () => {
      const initialTenantId = 'initial-tenant-12345';
      const newTenantId = 'new-tenant-12345';
      const appKey = 'test-app-key-12345678';
      const appSecret = 'test-app-secret-1234567890123456';

      const testEnv = { ...process.env, HOME: tempDir, USERPROFILE: tempDir };


      try {
        // 初始化配置
        execSync(
          `npx ts-node src/bin/ybc.ts config init --non-interactive --tenant-id "${initialTenantId}" --app-key "${appKey}" --app-secret "${appSecret}"`,
          {
            encoding: 'utf-8',
            cwd: process.cwd(),
            env: testEnv,
          }
        );

        // 修改 Tenant ID
        const result = execSync(`npx ts-node src/bin/ybc.ts config set tenantId "${newTenantId}"`, {
          encoding: 'utf-8',
          cwd: process.cwd(),
          env: testEnv,
        });

        expect(result).toContain('修改配置');
        expect(result).toContain('字段');
        expect(result).toContain('tenantId');
        expect(result).toContain('旧值');
        expect(result).toContain(initialTenantId);
        expect(result).toContain('新值');
        expect(result).toContain(newTenantId);
        expect(result).toContain('配置已更新');

        // 验证配置文件
        const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        expect(config.tenantId).toBe(newTenantId);
      } finally {
        // 清理
      }
    });

    it('应该成功修改 App Key', () => {
      const tenantId = 'test-tenant-12345';
      const initialAppKey = 'initial-app-key-12345678';
      const newAppKey = 'new-app-key-12345678';
      const appSecret = 'test-app-secret-1234567890123456';

      const testEnv = { ...process.env, HOME: tempDir, USERPROFILE: tempDir };


      try {
        // 初始化配置
        execSync(
          `npx ts-node src/bin/ybc.ts config init --non-interactive --tenant-id "${tenantId}" --app-key "${initialAppKey}" --app-secret "${appSecret}"`,
          {
            encoding: 'utf-8',
            cwd: process.cwd(),
            env: testEnv,
          }
        );

        // 修改 App Key
        const result = execSync(`npx ts-node src/bin/ybc.ts config set appKey "${newAppKey}"`, {
          encoding: 'utf-8',
          cwd: process.cwd(),
          env: testEnv,
        });

        expect(result).toContain('修改配置');
        expect(result).toContain('字段');
        expect(result).toContain('appKey');
        expect(result).toContain('旧值');
        expect(result).toContain(initialAppKey);
        expect(result).toContain('新值');
        expect(result).toContain(newAppKey);
        expect(result).toContain('配置已更新');

        // 验证配置文件
        const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        expect(config.appKey).toBe(newAppKey);
      } finally {
        // 清理
      }
    });

    it('应该成功修改环境', () => {
      const tenantId = 'test-tenant-12345';
      const appKey = 'test-app-key-12345678';
      const appSecret = 'test-app-secret-1234567890123456';

      const testEnv = { ...process.env, HOME: tempDir, USERPROFILE: tempDir };


      try {
        // 初始化配置（sandbox）
        execSync(
          `npx ts-node src/bin/ybc.ts config init --non-interactive --tenant-id "${tenantId}" --app-key "${appKey}" --app-secret "${appSecret}"`,
          {
            encoding: 'utf-8',
            cwd: process.cwd(),
            env: testEnv,
          }
        );

        // 修改环境为 production
        const result = execSync('npx ts-node src/bin/ybc.ts config set env production', {
          encoding: 'utf-8',
          cwd: process.cwd(),
          env: testEnv,
        });

        expect(result).toContain('旧值');
        expect(result).toContain('sandbox');
        expect(result).toContain('新值');
        expect(result).toContain('production');
        expect(result).toContain('配置已更新');

        // 验证配置文件
        const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        expect(config.env).toBe('production');
      } finally {
        // 清理
      }
    });

    it('应该成功修改输出格式', () => {
      const tenantId = 'test-tenant-12345';
      const appKey = 'test-app-key-12345678';
      const appSecret = 'test-app-secret-1234567890123456';

      const testEnv = { ...process.env, HOME: tempDir, USERPROFILE: tempDir };


      try {
        // 初始化配置（table）
        execSync(
          `npx ts-node src/bin/ybc.ts config init --non-interactive --tenant-id "${tenantId}" --app-key "${appKey}" --app-secret "${appSecret}"`,
          {
            encoding: 'utf-8',
            cwd: process.cwd(),
            env: testEnv,
          }
        );

        // 修改输出格式为 json
        const result = execSync('npx ts-node src/bin/ybc.ts config set format json', {
          encoding: 'utf-8',
          cwd: process.cwd(),
          env: testEnv,
        });

        expect(result).toContain('旧值');
        expect(result).toContain('table');
        expect(result).toContain('新值');
        expect(result).toContain('json');
        expect(result).toContain('配置已更新');

        // 验证配置文件
        const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        expect(config.format).toBe('json');
      } finally {
        // 清理
      }
    });

    it('应该拒绝无效的字段名', () => {
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

        // 尝试修改无效字段
        expect(() => {
          execSync('npx ts-node src/bin/ybc.ts config set invalid_field value', {
            encoding: 'utf-8',
            cwd: process.cwd(),
            env: testEnv,
          });
        }).toThrow();
      } finally {
        // 清理
      }
    });

    it('应该拒绝无效的环境值', () => {
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

        // 尝试设置无效环境
        expect(() => {
          execSync('npx ts-node src/bin/ybc.ts config set env invalid_env', {
            encoding: 'utf-8',
            cwd: process.cwd(),
            env: testEnv,
          });
        }).toThrow();
      } finally {
        // 清理
      }
    });

    it('应该拒绝无效的输出格式', () => {
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

        // 尝试设置无效格式
        expect(() => {
          execSync('npx ts-node src/bin/ybc.ts config set format invalid_format', {
            encoding: 'utf-8',
            cwd: process.cwd(),
            env: testEnv,
          });
        }).toThrow();
      } finally {
        // 清理
      }
    });

    it('应该拒绝过短的 Tenant ID', () => {
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

        // 尝试设置空的 Tenant ID
        expect(() => {
          execSync('npx ts-node src/bin/ybc.ts config set tenantId ""', {
            encoding: 'utf-8',
            cwd: process.cwd(),
            env: testEnv,
          });
        }).toThrow();
      } finally {
        // 清理
      }
    });

    it('应该拒绝过短的 App Key', () => {
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

        // 尝试设置过短的 App Key
        expect(() => {
          execSync('npx ts-node src/bin/ybc.ts config set appKey short', {
            encoding: 'utf-8',
            cwd: process.cwd(),
            env: testEnv,
          });
        }).toThrow();
      } finally {
        // 清理
      }
    });

    it('应该在配置文件不存在时拒绝修改', () => {
      const testEnv = { ...process.env, HOME: tempDir, USERPROFILE: tempDir };


      try {
        expect(() => {
          execSync('npx ts-node src/bin/ybc.ts config set tenantId test-tenant-id', {
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
});
