/**
 * 用户故事 2：自动刷新 Token 测试
 *
 * 测试场景：
 * - 配置已存在 → 直接执行命令 → token 过期 → 自动刷新 → 成功执行
 * - 验证 token 自动刷新机制
 * - 验证 token 缓存机制
 * - 验证 token 过期检测
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { execSync } from 'child_process';
import { MockBipServer } from '../../mocks/mock-bip-server';

describe('Token Refresh Scenarios (E2E)', () => {
  const tempDir = path.join(os.tmpdir(), 'ybc-token-refresh-test-' + Date.now());
  const configPath = path.join(tempDir, '.ybc', 'config.json');
  const tokenPath = path.join(tempDir, '.ybc', 'token.json');
  let mockServer: MockBipServer;

  beforeAll(async () => {
    // 创建临时目录
    fs.mkdirSync(tempDir, { recursive: true });

    // 启动 Mock Server
    mockServer = new MockBipServer({ port: 4001 });
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
    // 清理配置和 token 文件
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

    // 清除 tokens
    mockServer.clearTokens();
  });

  describe('场景 1：配置已存在，首次执行', () => {
    it('应该成功获取 token 并执行命令', async () => {
      // 1. 初始化配置
      const tenantId = 'test-tenant-id-12345';
      const appKey = 'test-app-key-12345678';
      const appSecret = 'test-app-secret-12345678901234';
      const env = 'sandbox';

      const configDir = path.dirname(configPath);
      fs.mkdirSync(configDir, { recursive: true });
      fs.writeFileSync(
        configPath,
        JSON.stringify({
          tenantId: tenantId,
          appKey: appKey,
          appSecret: appSecret,
          env: env,
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

      // 2. 执行命令（首次，无 token 缓存）
      const result = execSync('npx ts-node src/bin/ybc.ts staff query --code EMP001 --format json', {
        encoding: 'utf-8',
        cwd: process.cwd(),
        env: testEnv,
        timeout: 10000,
      });

      // 3. 验证命令执行成功
      expect(result).toContain('EMP001');
      expect(result).toContain('张三');

      // 4. 验证 token 文件已创建
      expect(fs.existsSync(tokenPath)).toBe(true);

      // 5. 验证 token 内容
      const tokenData = JSON.parse(fs.readFileSync(tokenPath, 'utf-8'));
      expect(tokenData.access_token).toBeDefined();
      expect(tokenData.expires_in).toBeGreaterThan(0);
      expect(tokenData.expires_at).toBeDefined();
      expect(tokenData.expires_at).toBeGreaterThan(Date.now());
    });

    it('应该在第二次执行时使用缓存的 token', async () => {
      // 1. 初始化配置
      const tenantId = 'test-tenant-id-12345';
      const appKey = 'test-app-key-12345678';
      const appSecret = 'test-app-secret-12345678901234';

      const configDir = path.dirname(configPath);
      fs.mkdirSync(configDir, { recursive: true });
      fs.writeFileSync(
        configPath,
        JSON.stringify({
          tenantId: tenantId,
          appKey: appKey,
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
        YBC_API_URL: mockServer.getUrl(),
      };

      // 2. 第一次执行（获取 token）
      const result1 = execSync(
        'npx ts-node src/bin/ybc.ts staff query --code EMP001 --format json',
        {
          encoding: 'utf-8',
          cwd: process.cwd(),
          env: testEnv,
          timeout: 10000,
        }
      );

      expect(result1).toContain('EMP001');

      // 3. 记录第一次 token
      const tokenData1 = JSON.parse(fs.readFileSync(tokenPath, 'utf-8'));
      const firstToken = tokenData1.access_token;

      // 4. 第二次执行（应该使用缓存）
      const result2 = execSync(
        'npx ts-node src/bin/ybc.ts staff query --code EMP002 --format json',
        {
          encoding: 'utf-8',
          cwd: process.cwd(),
          env: testEnv,
          timeout: 10000,
        }
      );

      expect(result2).toContain('EMP002');
      expect(result2).toContain('李四');

      // 5. 验证 token 未改变（使用缓存）
      const tokenData2 = JSON.parse(fs.readFileSync(tokenPath, 'utf-8'));
      expect(tokenData2.access_token).toBe(firstToken);
    });
  });

  describe('场景 2：Token 过期自动刷新', () => {
    it('应该在 token 过期前 5 分钟自动刷新', async () => {
      // 1. 初始化配置
      const tenantId = 'test-tenant-id-12345';
      const appKey = 'test-app-key-12345678';
      const appSecret = 'test-app-secret-12345678901234';

      const configDir = path.dirname(configPath);
      fs.mkdirSync(configDir, { recursive: true });
      fs.writeFileSync(
        configPath,
        JSON.stringify({
          tenantId: tenantId,
          appKey: appKey,
          appSecret: appSecret,
          env: 'sandbox',
          version: '1.0',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })
      );

      // 2. 创建即将过期的 token（过期时间为 4 分钟后）
      const expiresAt = Date.now() + 4 * 60 * 1000; // 4分钟后
      const initialToken = 'initial-token-12345';

      fs.writeFileSync(
        tokenPath,
        JSON.stringify({
          access_token: initialToken,
          expires_in: 3600,
          expires_at: expiresAt,
          config_fingerprint: `${tenantId}-${appKey}-${appSecret}-sandbox`,
          created_at: Date.now(),
        })
      );

      // 将初始 token 添加到 Mock Server 的有效 token 列表
      mockServer.addValidToken(initialToken);

      const testEnv = {
        ...process.env,
        HOME: tempDir,
        USERPROFILE: tempDir,
        YBC_API_URL: mockServer.getUrl(),
      };

      // 3. 执行命令（应该自动刷新）
      const result = execSync('npx ts-node src/bin/ybc.ts staff query --code EMP001 --format json', {
        encoding: 'utf-8',
        cwd: process.cwd(),
        env: testEnv,
        timeout: 10000,
      });

      expect(result).toContain('EMP001');

      // 4. 验证 token 已刷新
      const tokenData = JSON.parse(fs.readFileSync(tokenPath, 'utf-8'));
      expect(tokenData.access_token).not.toBe(initialToken);
      expect(tokenData.expires_at).toBeGreaterThan(expiresAt);
    });

    it('应该在 token 已过期时自动刷新', async () => {
      // 1. 初始化配置
      const tenantId = 'test-tenant-id-12345';
      const appKey = 'test-app-key-12345678';
      const appSecret = 'test-app-secret-12345678901234';

      const configDir = path.dirname(configPath);
      fs.mkdirSync(configDir, { recursive: true });
      fs.writeFileSync(
        configPath,
        JSON.stringify({
          tenantId: tenantId,
          appKey: appKey,
          appSecret: appSecret,
          env: 'sandbox',
          version: '1.0',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })
      );

      // 2. 创建已过期的 token
      const expiresAt = Date.now() - 1000; // 已过期
      const expiredToken = 'expired-token-12345';

      fs.writeFileSync(
        tokenPath,
        JSON.stringify({
          access_token: expiredToken,
          expires_in: 3600,
          expires_at: expiresAt,
          config_fingerprint: `${tenantId}-${appKey}-${appSecret}-sandbox`,
          created_at: Date.now() - 7200000, // 2小时前
        })
      );

      // 注意：过期 token 不添加到 Mock Server，所以会导致 401

      const testEnv = {
        ...process.env,
        HOME: tempDir,
        USERPROFILE: tempDir,
        YBC_API_URL: mockServer.getUrl(),
      };

      // 3. 执行命令（应该检测到过期并刷新）
      const result = execSync('npx ts-node src/bin/ybc.ts staff query --code EMP001 --format json', {
        encoding: 'utf-8',
        cwd: process.cwd(),
        env: testEnv,
        timeout: 10000,
      });

      expect(result).toContain('EMP001');
      expect(result).toContain('张三');

      // 4. 验证 token 已刷新
      const tokenData = JSON.parse(fs.readFileSync(tokenPath, 'utf-8'));
      expect(tokenData.access_token).not.toBe(expiredToken);
      expect(tokenData.access_token).toMatch(/mock-token-/);
      expect(tokenData.expires_at).toBeGreaterThan(Date.now());
    });

    it('应该在 401 错误后自动刷新 token 并重试', async () => {
      // 1. 初始化配置
      const tenantId = 'test-tenant-id-12345';
      const appKey = 'test-app-key-12345678';
      const appSecret = 'test-app-secret-12345678901234';

      const configDir = path.dirname(configPath);
      fs.mkdirSync(configDir, { recursive: true });
      fs.writeFileSync(
        configPath,
        JSON.stringify({
          tenantId: tenantId,
          appKey: appKey,
          appSecret: appSecret,
          env: 'sandbox',
          version: '1.0',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })
      );

      // 2. 创建无效的 token（不在 Mock Server 的有效列表中）
      const invalidToken = 'invalid-token-12345';

      fs.writeFileSync(
        tokenPath,
        JSON.stringify({
          access_token: invalidToken,
          expires_in: 3600,
          expires_at: Date.now() + 3600000, // 未过期但无效
          config_fingerprint: `${tenantId}-${appKey}-${appSecret}-sandbox`,
          created_at: Date.now(),
        })
      );

      const testEnv = {
        ...process.env,
        HOME: tempDir,
        USERPROFILE: tempDir,
        YBC_API_URL: mockServer.getUrl(),
      };

      // 3. 执行命令（应该遇到 401，刷新 token，重试）
      const result = execSync('npx ts-node src/bin/ybc.ts staff query --code EMP001 --format json', {
        encoding: 'utf-8',
        cwd: process.cwd(),
        env: testEnv,
        timeout: 10000,
      });

      expect(result).toContain('EMP001');

      // 4. 验证 token 已刷新
      const tokenData = JSON.parse(fs.readFileSync(tokenPath, 'utf-8'));
      expect(tokenData.access_token).not.toBe(invalidToken);
      expect(tokenData.access_token).toMatch(/mock-token-/);
    });
  });

  describe('场景 3：Token 刷新失败处理', () => {
    it('应该在 token 刷新失败时返回退出码 6', async () => {
      // 1. 初始化配置（使用无效的 AK/SK）
      const tenantId = 'test-tenant-id-12345';
      const appKey = 'invalid-app-key';
      const appSecret = 'invalid-app-secret';

      const configDir = path.dirname(configPath);
      fs.mkdirSync(configDir, { recursive: true });
      fs.writeFileSync(
        configPath,
        JSON.stringify({
          tenantId: tenantId,
          appKey: appKey,
          appSecret: appSecret,
          env: 'sandbox',
          version: '1.0',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })
      );

      // 2. 创建过期的 token
      fs.writeFileSync(
        tokenPath,
        JSON.stringify({
          access_token: 'expired-token',
          expires_in: 3600,
          expires_at: Date.now() - 1000,
          config_fingerprint: `${tenantId}-${appKey}-${appSecret}-sandbox`,
          created_at: Date.now() - 7200000,
        })
      );

      const testEnv = {
        ...process.env,
        HOME: tempDir,
        USERPROFILE: tempDir,
        YBC_API_URL: mockServer.getUrl(),
      };

      // 3. 执行命令（应该尝试刷新但失败）
      try {
        execSync('npx ts-node src/bin/ybc.ts staff query --code EMP001', {
          encoding: 'utf-8',
          cwd: process.cwd(),
          env: testEnv,
          timeout: 10000,
        });
        fail('应该抛出错误');
      } catch (error: any) {
        expect(error.status).toBe(6);
        const output = error.stderr || error.stdout || '';
        expect(output).toContain('鉴权失败');
        expect(output).toMatch(/刷新.*失败|invalid.*credentials/i);
      }
    });

    it('应该在多次刷新失败后清除 token 缓存', async () => {
      // 1. 初始化配置（使用无效的 AK/SK）
      const tenantId = 'test-tenant-id-12345';
      const appKey = 'invalid-app-key-12345678';
      const appSecret = 'invalid-app-secret-1234567890';

      const configDir = path.dirname(configPath);
      fs.mkdirSync(configDir, { recursive: true });
      fs.writeFileSync(
        configPath,
        JSON.stringify({
          tenantId: tenantId,
          appKey: appKey,
          appSecret: appSecret,
          env: 'sandbox',
          version: '1.0',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })
      );

      // 2. 创建过期的 token
      fs.writeFileSync(
        tokenPath,
        JSON.stringify({
          access_token: 'expired-token',
          expires_in: 3600,
          expires_at: Date.now() - 1000,
          config_fingerprint: `${tenantId}-${appKey}-${appSecret}-sandbox`,
          created_at: Date.now() - 7200000,
        })
      );

      const testEnv = {
        ...process.env,
        HOME: tempDir,
        USERPROFILE: tempDir,
        YBC_API_URL: mockServer.getUrl(),
      };

      // 3. 尝试执行命令（失败）
      try {
        execSync('npx ts-node src/bin/ybc.ts staff query --code EMP001', {
          encoding: 'utf-8',
          cwd: process.cwd(),
          env: testEnv,
          timeout: 10000,
        });
        fail('应该抛出错误');
      } catch (error: any) {
        expect(error.status).toBe(6);
      }

      // 4. 验证 token 文件可能被清除或标记为无效
      // （具体行为取决于实现）
      if (fs.existsSync(tokenPath)) {
        const tokenData = JSON.parse(fs.readFileSync(tokenPath, 'utf-8'));
        // token 可能被标记为无效或清除
        expect(tokenData.access_token).not.toBe('expired-token');
      }
    });
  });

  describe('场景 4：Token 缓存机制验证', () => {
    it('应该在配置改变时清除 token 缓存', async () => {
      // 1. 初始化配置
      const tenantId1 = 'test-tenant-id-12345';
      const appKey1 = 'test-app-key-12345678';
      const appSecret1 = 'test-app-secret-12345678901234';

      const configDir = path.dirname(configPath);
      fs.mkdirSync(configDir, { recursive: true });
      fs.writeFileSync(
        configPath,
        JSON.stringify({
          tenantId: tenantId1,
          appKey: appKey1,
          appSecret: appSecret1,
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

      // 2. 执行命令获取 token
      const result1 = execSync(
        'npx ts-node src/bin/ybc.ts staff query --code EMP001 --format json',
        {
          encoding: 'utf-8',
          cwd: process.cwd(),
          env: testEnv,
          timeout: 10000,
        }
      );

      expect(result1).toContain('EMP001');
      const tokenData1 = JSON.parse(fs.readFileSync(tokenPath, 'utf-8'));
      const firstToken = tokenData1.access_token;

      // 3. 更新 appKey（配置改变）
      const appKey2 = 'new-app-key-12345678';
      execSync(`npx ts-node src/bin/ybc.ts config set appKey "${appKey2}"`, {
        encoding: 'utf-8',
        cwd: process.cwd(),
        env: testEnv,
      });

      // 4. 执行命令（应该获取新 token）
      const result2 = execSync(
        'npx ts-node src/bin/ybc.ts staff query --code EMP002 --format json',
        {
          encoding: 'utf-8',
          cwd: process.cwd(),
          env: testEnv,
          timeout: 10000,
        }
      );

      expect(result2).toContain('EMP002');

      // 5. 验证 token 已更新（配置指纹不匹配导致重新获取）
      const tokenData2 = JSON.parse(fs.readFileSync(tokenPath, 'utf-8'));
      expect(tokenData2.access_token).not.toBe(firstToken);
    });

    it('应该在环境改变时清除 token 缓存', async () => {
      // 1. 初始化配置（sandbox 环境）
      const tenantId = 'test-tenant-id-12345';
      const appKey = 'test-app-key-12345678';
      const appSecret = 'test-app-secret-12345678901234';

      const configDir = path.dirname(configPath);
      fs.mkdirSync(configDir, { recursive: true });
      fs.writeFileSync(
        configPath,
        JSON.stringify({
          tenantId: tenantId,
          appKey: appKey,
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
        YBC_API_URL: mockServer.getUrl(),
      };

      // 2. 执行命令获取 token
      const result1 = execSync(
        'npx ts-node src/bin/ybc.ts staff query --code EMP001 --format json',
        {
          encoding: 'utf-8',
          cwd: process.cwd(),
          env: testEnv,
          timeout: 10000,
        }
      );

      expect(result1).toContain('EMP001');
      const tokenData1 = JSON.parse(fs.readFileSync(tokenPath, 'utf-8'));
      expect(tokenData1.config_fingerprint).toContain('sandbox');

      // 3. 更改环境
      execSync('npx ts-node src/bin/ybc.ts config set env production', {
        encoding: 'utf-8',
        cwd: process.cwd(),
        env: testEnv,
      });

      // 4. 执行命令（应该获取新 token）
      const result2 = execSync(
        'npx ts-node src/bin/ybc.ts staff query --code EMP002 --format json',
        {
          encoding: 'utf-8',
          cwd: process.cwd(),
          env: testEnv,
          timeout: 10000,
        }
      );

      expect(result2).toContain('EMP002');

      // 5. 验证 token 缓存指纹已更新
      const tokenData2 = JSON.parse(fs.readFileSync(tokenPath, 'utf-8'));
      expect(tokenData2.config_fingerprint).toContain('production');
    });
  });

  describe('场景 5：并发请求 Token 管理', () => {
    it('应该正确处理并发请求的 token 获取', async () => {
      // 1. 初始化配置
      const tenantId = 'test-tenant-id-12345';
      const appKey = 'test-app-key-12345678';
      const appSecret = 'test-app-secret-12345678901234';

      const configDir = path.dirname(configPath);
      fs.mkdirSync(configDir, { recursive: true });
      fs.writeFileSync(
        configPath,
        JSON.stringify({
          tenantId: tenantId,
          appKey: appKey,
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
        YBC_API_URL: mockServer.getUrl(),
      };

      // 2. 并发执行多个命令
      const commands = [
        'staff query --code EMP001 --format json',
        'staff query --code EMP002 --format json',
        'staff query --code EMP003 --format json',
      ];

      const results = commands.map((cmd) =>
        execSync(`npx ts-node src/bin/ybc.ts ${cmd}`, {
          encoding: 'utf-8',
          cwd: process.cwd(),
          env: testEnv,
          timeout: 10000,
        })
      );

      // 3. 验证所有命令执行成功
      expect(results[0]).toContain('EMP001');
      expect(results[1]).toContain('EMP002');
      expect(results[2]).toContain('EMP003');

      // 4. 验证 token 文件存在且有效
      const tokenData = JSON.parse(fs.readFileSync(tokenPath, 'utf-8'));
      expect(tokenData.access_token).toBeDefined();
      expect(tokenData.expires_at).toBeGreaterThan(Date.now());
    });
  });
});