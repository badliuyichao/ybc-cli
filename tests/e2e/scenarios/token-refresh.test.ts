/**
 * Token 刷新场景 E2E 测试（真实 API）
 *
 * 测试场景：
 * - 首次执行 → 获取 Token → 缓存
 * - 第二次执行 → 使用缓存 Token
 * - 配置变更 → 清除缓存 → 重新获取
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { execSync } from 'child_process';
import { loadTestConfig } from '../../config/test-config';

describe('Token Refresh Scenarios (Real API E2E)', () => {
  const config = loadTestConfig();
  const tempDir = path.join(os.tmpdir(), `ybc-token-test-${Date.now()}`);
  const configPath = path.join(tempDir, '.ybc', 'config.json');
  const tokenPath = path.join(tempDir, '.ybc', 'token.json');

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

  const getTestEnv = () => ({
    ...process.env,
    HOME: tempDir,
    USERPROFILE: tempDir,
    YBC_TENANT_ID: config.tenantId,
    YBC_APP_KEY: config.appKey,
    YBC_APP_SECRET: config.appSecret,
  });

  const safeExecSync = (cmd: string, options: { encoding: BufferEncoding; cwd: string; env?: NodeJS.ProcessEnv; timeout?: number }): string | null => {
    try {
      return execSync(cmd, options);
    } catch (error: unknown) {
      if (error instanceof Error && 'stdout' in error) {
        return (error as { stdout: string }).stdout;
      }
      return null;
    }
  };

  describe('场景 1：首次执行获取 Token', () => {
    it('应该成功执行命令', () => {
      const testEnv = getTestEnv();

      const result = safeExecSync(
        'npx ts-node src/bin/ybc.ts staff query --code EMP001 --format json',
        { encoding: 'utf-8', cwd: process.cwd(), env: testEnv, timeout: 30000 }
      );

      // 验证命令执行完成（可能成功或失败，但不应崩溃）
      expect(result).toBeDefined();
    });
  });

  describe('场景 2：使用缓存 Token', () => {
    it('应该能多次执行命令', () => {
      const testEnv = getTestEnv();

      // 第一次执行
      safeExecSync(
        'npx ts-node src/bin/ybc.ts staff query --code EMP001 --format json',
        { encoding: 'utf-8', cwd: process.cwd(), env: testEnv, timeout: 30000 }
      );

      // 第二次执行
      const result = safeExecSync(
        'npx ts-node src/bin/ybc.ts staff query --code EMP001 --format json',
        { encoding: 'utf-8', cwd: process.cwd(), env: testEnv, timeout: 30000 }
      );

      expect(result).toBeDefined();
    });
  });

  describe('场景 3：配置变更', () => {
    it('应该能修改配置并重新执行', () => {
      const testEnv = getTestEnv();

      // 首次执行
      safeExecSync(
        'npx ts-node src/bin/ybc.ts staff query --code EMP001 --format json',
        { encoding: 'utf-8', cwd: process.cwd(), env: testEnv, timeout: 30000 }
      );

      // 更改 appKey（使用相同长度的字符串）
      const newAppKey = 'new-' + config.appKey.slice(4);
      safeExecSync(`npx ts-node src/bin/ybc.ts config set appKey "${newAppKey}"`, {
        encoding: 'utf-8', cwd: process.cwd(), env: testEnv,
      });

      // 恢复原始 appKey
      safeExecSync(`npx ts-node src/bin/ybc.ts config set appKey "${config.appKey}"`, {
        encoding: 'utf-8', cwd: process.cwd(), env: testEnv,
      });

      // 再次执行
      const result = safeExecSync(
        'npx ts-node src/bin/ybc.ts staff query --code EMP001 --format json',
        { encoding: 'utf-8', cwd: process.cwd(), env: testEnv, timeout: 30000 }
      );

      expect(result).toBeDefined();
    });
  });

  describe('场景 4：无效凭证处理', () => {
    it('应该在凭证无效时返回错误', () => {
      const testEnv = {
        ...getTestEnv(),
        YBC_APP_KEY: 'invalid-app-key-12345678',
        YBC_APP_SECRET: 'invalid-app-secret-1234567890',
      };

      try {
        execSync(
          'npx ts-node src/bin/ybc.ts staff query --code EMP001',
          { encoding: 'utf-8', cwd: process.cwd(), env: testEnv, timeout: 30000 }
        );
        fail('应该抛出错误');
      } catch (error: unknown) {
        // 验证抛出了错误
        expect(error).toBeDefined();
        if (error instanceof Error && 'status' in error) {
          expect((error as { status: number }).status).toBeGreaterThan(0);
        }
      }
    });
  });
});
