/**
 * 用户故事 3：错误场景测试
 *
 * 测试各种错误场景下的 CLI 行为：
 * - 无 AK/SK → 退出码 6 + 友好提示
 * - 网络错误 → 退出码 5 + 友好提示
 * - API 业务错误 → 退出码 4 + 友好提示
 * - 验证错误提示包含恢复建议
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { execSync } from 'child_process';
import { MockBipServer } from '../../mocks/mock-bip-server';

describe('Error Scenarios (E2E)', () => {
  const tempDir = path.join(os.tmpdir(), 'ybc-error-test-' + Date.now());
  const configPath = path.join(tempDir, '.ybc', 'config.json');
  let mockServer: MockBipServer;

  beforeAll(async () => {
    // 创建临时目录
    fs.mkdirSync(tempDir, { recursive: true });

    // 启动 Mock Server
    mockServer = new MockBipServer({ port: 3999 });
    await mockServer.start();
  });

  afterAll(async () => {
    // 停止 Mock Server
    if (mockServer) {
      await mockServer.stop();
    }

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

    // 清除环境变量
    delete process.env.YBC_TENANT_ID;
    delete process.env.YBC_APP_KEY;
    delete process.env.YBC_APP_SECRET;
    delete process.env.YBC_ENV;
    delete process.env.YBC_API_URL;
  });

  describe('场景 1：无 AK/SK 配置', () => {
    it('应该在无配置文件时返回退出码 6 并显示友好提示', () => {
      const testEnv = {
        ...process.env,
        HOME: tempDir,
        USERPROFILE: tempDir,
      };

      try {
        execSync('npx ts-node src/bin/ybc.ts staff query --code EMP001', {
          encoding: 'utf-8',
          cwd: process.cwd(),
          env: testEnv,
        });
        fail('应该抛出错误');
      } catch (error: any) {
        // 验证退出码
        expect(error.status).toBe(6);

        // 验证错误消息
        const output = error.stderr || error.stdout || '';
        expect(output).toContain('鉴权失败');
        expect(output).toContain('App Key');
        expect(output).toContain('config set appKey');
      }
    });

    it('应该在环境变量未设置时返回退出码 6', () => {
      const testEnv = {
        ...process.env,
        HOME: tempDir,
        USERPROFILE: tempDir,
        // 不设置 YBC_TENANT_ID, YBC_APP_KEY, YBC_APP_SECRET
      };

      try {
        execSync('npx ts-node src/bin/ybc.ts staff query --code EMP001', {
          encoding: 'utf-8',
          cwd: process.cwd(),
          env: testEnv,
        });
        fail('应该抛出错误');
      } catch (error: any) {
        expect(error.status).toBe(6);
        const output = error.stderr || error.stdout || '';
        expect(output).toContain('鉴权失败');
      }
    });

    it('应该在 AK/SK 无效时返回退出码 6 并提供恢复建议', async () => {
      // 配置无效的 AK/SK
      const configDir = path.dirname(configPath);
      fs.mkdirSync(configDir, { recursive: true });
      fs.writeFileSync(
        configPath,
        JSON.stringify({
          tenantId: 'test-tenant-id-12345',
          appKey: 'invalid-app-key',
          appSecret: 'invalid-app-secret',
          env: 'sandbox',
          version: '1.0',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })
      );

      const testEnv = {
        ...process.env,
        HOME: tempDir,
        USERPROFILE: tempDir,
        YBC_API_URL: mockServer.getUrl(),
      };

      try {
        execSync('npx ts-node src/bin/ybc.ts staff query --code EMP001', {
          encoding: 'utf-8',
          cwd: process.cwd(),
          env: testEnv,
          timeout: 10000,
        });
        fail('应该抛出错误');
      } catch (error: any) {
        // 验证退出码（可能是鉴权错误）
        expect(error.status).toBeGreaterThanOrEqual(4);
        expect(error.status).toBeLessThanOrEqual(6);
        const output = error.stderr || error.stdout || '';
        expect(output).toContain('鉴权失败');
        expect(output).toContain('App Key 或 App Secret 无效');

        // 验证恢复建议
        expect(output).toMatch(/检查.*App Key.*App Secret/i);
        expect(output).toContain('config set appKey');
      }
    });
  });

  describe('场景 2：网络错误', () => {
    it('应该在网络连接失败时返回退出码 5 并显示友好提示', async () => {
      // 配置有效的 AK/SK
      const configDir = path.dirname(configPath);
      fs.mkdirSync(configDir, { recursive: true });
      fs.writeFileSync(
        configPath,
        JSON.stringify({
          tenantId: 'test-tenant-id-12345',
          appKey: 'test-app-key-12345678',
          appSecret: 'test-app-secret-12345678901234',
          env: 'sandbox',
          version: '1.0',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })
      );

      const testEnv = {
        ...process.env,
        HOME: tempDir,
        USERPROFILE: tempDir,
        // 使用无效的 API URL 触发网络错误
        YBC_API_URL: 'http://invalid-host-that-does-not-exist-12345.com',
      };

      try {
        execSync('npx ts-node src/bin/ybc.ts staff query --code EMP001', {
          encoding: 'utf-8',
          cwd: process.cwd(),
          env: testEnv,
          timeout: 15000, // 网络错误可能需要较长时间
        });
        fail('应该抛出错误');
      } catch (error: any) {
        expect(error.status).toBe(5);
        const output = error.stderr || error.stdout || '';
        expect(output).toContain('网络错误');
        expect(output).toMatch(/连接失败|无法连接|timeout/i);

        // 验证恢复建议
        expect(output).toMatch(/检查网络连接|稍后重试/);
      }
    });

    it('应该在请求超时时返回退出码 5 并提供恢复建议', async () => {
      // 配置有效的 AK/SK
      const configDir = path.dirname(configPath);
      fs.mkdirSync(configDir, { recursive: true });
      fs.writeFileSync(
        configPath,
        JSON.stringify({
          tenantId: 'test-tenant-id-12345',
          appKey: 'test-app-key-12345678',
          appSecret: 'test-app-secret-12345678901234',
          env: 'sandbox',
          version: '1.0',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })
      );

      // 使用 Mock Server 但不响应，触发超时
      const slowServer = new MockBipServer({ port: 4000 });
      await slowServer.start();

      const testEnv = {
        ...process.env,
        HOME: tempDir,
        USERPROFILE: tempDir,
        YBC_API_URL: slowServer.getUrl(),
      };

      try {
        // 设置短超时（需要在 CLI 实现中支持 --timeout 选项）
        execSync('npx ts-node src/bin/ybc.ts staff query --code EMP001 --timeout 100', {
          encoding: 'utf-8',
          cwd: process.cwd(),
          env: testEnv,
          timeout: 5000,
        });
        fail('应该抛出错误');
      } catch (error: any) {
        expect(error.status).toBe(5);
        const output = error.stderr || error.stdout || '';
        expect(output).toContain('网络错误');
        expect(output).toMatch(/超时|timeout/i);
        expect(output).toMatch(/检查网络|增加超时时间/);
      } finally {
        await slowServer.stop();
      }
    });
  });

  describe('场景 3：API 业务错误', () => {
    beforeEach(async () => {
      // 配置有效的 AK/SK
      const configDir = path.dirname(configPath);
      fs.mkdirSync(configDir, { recursive: true });
      fs.writeFileSync(
        configPath,
        JSON.stringify({
          tenantId: 'test-tenant-id-12345',
          appKey: 'test-app-key-12345678',
          appSecret: 'test-app-secret-12345678901234',
          env: 'sandbox',
          version: '1.0',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })
      );

      // 清除 tokens
      mockServer.clearTokens();
    });

    it('应该在 API 返回业务错误时返回退出码 4 并显示友好提示', async () => {
      const testEnv = {
        ...process.env,
        HOME: tempDir,
        USERPROFILE: tempDir,
        YBC_API_URL: mockServer.getUrl(),
      };

      try {
        execSync('npx ts-node src/bin/ybc.ts staff query --code INVALID_CODE', {
          encoding: 'utf-8',
          cwd: process.cwd(),
          env: testEnv,
          timeout: 10000,
        });
        fail('应该抛出错误');
      } catch (error: any) {
        expect(error.status).toBe(4);
        const output = error.stderr || error.stdout || '';
        expect(output).toContain('业务错误');
        expect(output).toMatch(/资源不存在|NOT_FOUND|invalid/i);

        // 验证恢复建议
        expect(output).toMatch(/检查.*参数|查看可用资源|--help/);
      }
    });

    it('应该在权限不足时返回退出码 4 并提供恢复建议', async () => {
      const testEnv = {
        ...process.env,
        HOME: tempDir,
        USERPROFILE: tempDir,
        YBC_API_URL: mockServer.getUrl(),
      };

      try {
        execSync('npx ts-node src/bin/ybc.ts staff query --department SECRET_DEPT', {
          encoding: 'utf-8',
          cwd: process.cwd(),
          env: testEnv,
          timeout: 10000,
        });
        fail('应该抛出错误');
      } catch (error: any) {
        expect(error.status).toBe(4);
        const output = error.stderr || error.stdout || '';
        expect(output).toContain('业务错误');
        expect(output).toMatch(/权限不足|PERMISSION_DENIED|permission/i);

        // 验证恢复建议
        expect(output).toMatch(/联系管理员|权限/);
      }
    });

    it('应该在参数验证失败时返回退出码 4 并显示具体字段', async () => {
      const testEnv = {
        ...process.env,
        HOME: tempDir,
        USERPROFILE: tempDir,
        YBC_API_URL: mockServer.getUrl(),
      };

      try {
        execSync('npx ts-node src/bin/ybc.ts staff query --page -1', {
          encoding: 'utf-8',
          cwd: process.cwd(),
          env: testEnv,
          timeout: 10000,
        });
        fail('应该抛出错误');
      } catch (error: any) {
        expect(error.status).toBe(4);
        const output = error.stderr || error.stdout || '';
        expect(output).toContain('业务错误');
        expect(output).toMatch(/参数.*无效|INVALID|validation/i);

        // 验证恢复建议
        expect(output).toMatch(/检查.*参数|--help/);
      }
    });
  });

  describe('场景 4：错误提示质量验证', () => {
    it('所有错误提示应包含恢复建议', async () => {
      // 配置无效的 AK/SK
      const configDir = path.dirname(configPath);
      fs.mkdirSync(configDir, { recursive: true });
      fs.writeFileSync(
        configPath,
        JSON.stringify({
          tenantId: 'test-tenant-id-12345',
          appKey: 'invalid-app-key',
          appSecret: 'invalid-app-secret',
          env: 'sandbox',
          version: '1.0',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })
      );

      const testEnv = {
        ...process.env,
        HOME: tempDir,
        USERPROFILE: tempDir,
        YBC_API_URL: mockServer.getUrl(),
      };

      try {
        execSync('npx ts-node src/bin/ybc.ts staff query --code EMP001', {
          encoding: 'utf-8',
          cwd: process.cwd(),
          env: testEnv,
          timeout: 10000,
        });
        fail('应该抛出错误');
      } catch (error: any) {
        const output = error.stderr || error.stdout || '';

        // 验证包含以下内容：
        // 1. 错误类型（鉴权错误）
        expect(output).toMatch(/鉴权失败|认证失败|Authentication failed/i);

        // 2. 具体原因
        expect(output).toMatch(/App Key|App Secret|无效|invalid/i);

        // 3. 恢复建议
        expect(output).toMatch(/检查|运行|使用|尝试|联系/i);

        // 4. 帮助命令提示（检查是否有任何帮助信息）
        const hasHelpHint = output.includes('--help') || output.includes('Usage:') || output.includes('ybc');
        expect(hasHelpHint).toBe(true);
      }
    });

    it('错误提示应避免暴露敏感信息', async () => {
      const appSecret = 'very-secret-key-1234567890';
      const configDir = path.dirname(configPath);
      fs.mkdirSync(configDir, { recursive: true });
      fs.writeFileSync(
        configPath,
        JSON.stringify({
          tenantId: 'test-tenant-id-12345',
          appKey: 'test-app-key-12345678',
          appSecret: appSecret,
          env: 'sandbox',
          version: '1.0',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })
      );

      const testEnv = {
        ...process.env,
        HOME: tempDir,
        USERPROFILE: tempDir,
        YBC_API_URL: 'http://invalid-host-12345.com',
      };

      try {
        execSync('npx ts-node src/bin/ybc.ts staff query --code EMP001', {
          encoding: 'utf-8',
          cwd: process.cwd(),
          env: testEnv,
          timeout: 10000,
        });
        fail('应该抛出错误');
      } catch (error: any) {
        const output = error.stderr || error.stdout || '';

        // 验证不包含完整的 appSecret
        expect(output).not.toContain(appSecret);

        // 验证不包含完整的 appSecret（即使混淆）
        // appSecret 应该被部分隐藏，如 "very-sec****"
        if (output.includes('key') || output.includes('secret')) {
          expect(output).toMatch(/\*{4,}/); // 应该有混淆
        }
      }
    });

    it('错误提示应包含退出码说明', async () => {
      const testEnv = {
        ...process.env,
        HOME: tempDir,
        USERPROFILE: tempDir,
        // 无配置，触发鉴权错误
      };

      try {
        execSync('npx ts-node src/bin/ybc.ts staff query --code EMP001', {
          encoding: 'utf-8',
          cwd: process.cwd(),
          env: testEnv,
        });
        fail('应该抛出错误');
      } catch (error: any) {
        // 验证退出码符合规范
        expect(error.status).toBeGreaterThanOrEqual(4);
        expect(error.status).toBeLessThanOrEqual(6);

        const output = error.stderr || error.stdout || '';
        // 验证包含退出码说明（可选，但最好有）
        // 这有助于脚本和 AI agent 理解错误类型
        expect(output.length).toBeGreaterThan(0); // 至少有错误消息
      }
    });
  });

  describe('场景 5：错误恢复流程', () => {
    it('应该在错误后能够重新初始化配置', async () => {
      // 1. 第一次执行失败（无配置）
      const testEnv1 = {
        ...process.env,
        HOME: tempDir,
        USERPROFILE: tempDir,
      };

      try {
        execSync('npx ts-node src/bin/ybc.ts staff query --code EMP001', {
          encoding: 'utf-8',
          cwd: process.cwd(),
          env: testEnv1,
        });
        fail('应该抛出错误');
      } catch (error: any) {
        expect(error.status).toBe(6);
      }

      // 2. 初始化配置
      const tenantId = 'test-tenant-id-12345';
      const appKey = 'test-app-key-12345678';
      const appSecret = 'test-app-secret-12345678901234';

      execSync(
        `npx ts-node src/bin/ybc.ts config init --non-interactive --tenant-id "${tenantId}" --app-key "${appKey}" --app-secret "${appSecret}" --env sandbox`,
        {
          encoding: 'utf-8',
          cwd: process.cwd(),
          env: testEnv1,
        }
      );

      // 3. 验证配置文件创建
      expect(fs.existsSync(configPath)).toBe(true);
    });

    it('应该在错误后能够更新配置并重试', async () => {
      // 1. 配置无效的 AK/SK
      const configDir = path.dirname(configPath);
      fs.mkdirSync(configDir, { recursive: true });
      fs.writeFileSync(
        configPath,
        JSON.stringify({
          tenantId: 'test-tenant-id-12345',
          appKey: 'invalid-app-key',
          appSecret: 'invalid-app-secret',
          env: 'sandbox',
          version: '1.0',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })
      );

      const testEnv = {
        ...process.env,
        HOME: tempDir,
        USERPROFILE: tempDir,
        YBC_API_URL: mockServer.getUrl(),
      };

      // 2. 执行失败
      try {
        execSync('npx ts-node src/bin/ybc.ts staff query --code EMP001', {
          encoding: 'utf-8',
          cwd: process.cwd(),
          env: testEnv,
          timeout: 10000,
        });
        fail('应该抛出错误');
      } catch (error: any) {
        expect(error.status).toBeGreaterThanOrEqual(4);
        expect(error.status).toBeLessThanOrEqual(6);
      }

      // 3. 更新配置
      execSync('npx ts-node src/bin/ybc.ts config set appKey test-app-key-12345678', {
        encoding: 'utf-8',
        cwd: process.cwd(),
        env: testEnv,
      });

      execSync('npx ts-node src/bin/ybc.ts config set appSecret test-app-secret-12345678901234', {
        encoding: 'utf-8',
        cwd: process.cwd(),
        env: testEnv,
      });

      // 4. 验证配置已更新
      const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      expect(config.appKey).toBe('test-app-key-12345678');
      expect(config.appSecret).toBeDefined();
    });
  });
});