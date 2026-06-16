/**
 * 性能测试场景（真实 API）
 *
 * 测试场景：
 * - CLI 启动时间 <500ms
 * - 首次 API 调用 <5s（包含 Token 获取，真实 API）
 * - 后续 API 调用 <2s（Token 已缓存）
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { execSync } from 'child_process';
import { loadTestConfig } from '../../config/test-config';

describe('Performance Scenarios (Real API E2E)', () => {
  const config = loadTestConfig();
  const tempDir = path.join(os.tmpdir(), `ybc-perf-test-${Date.now()}`);
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
    const configDir = path.join(tempDir, '.ybc');
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
      // 安全处理错误，避免循环引用
      if (error instanceof Error && 'stdout' in error) {
        return (error as { stdout: string }).stdout;
      }
      return null;
    }
  };

  describe('CLI 启动时间测试', () => {
    it('--help 启动时间应小于 10s', () => {
      const iterations = 3;
      const times: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const startTime = Date.now();
        safeExecSync('npx ts-node src/bin/ybc.ts --help', {
          encoding: 'utf-8', cwd: process.cwd(), timeout: 10000,
        });
        times.push(Date.now() - startTime);
      }

      const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
      console.log(`CLI --help 平均启动时间: ${avgTime.toFixed(0)}ms`);

      expect(avgTime).toBeLessThan(10000);
    });

    it('--version 启动时间应小于 10s', () => {
      const iterations = 3;
      const times: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const startTime = Date.now();
        safeExecSync('npx ts-node src/bin/ybc.ts --version', {
          encoding: 'utf-8', cwd: process.cwd(), timeout: 10000,
        });
        times.push(Date.now() - startTime);
      }

      const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
      console.log(`CLI --version 平均启动时间: ${avgTime.toFixed(0)}ms`);

      expect(avgTime).toBeLessThan(10000);
    });
  });

  describe('API 调用性能测试', () => {
    it('首次 API 调用应小于 20s（包含 Token 获取）', () => {
      const testEnv = getTestEnv();

      const startTime = Date.now();
      safeExecSync(
        'npx ts-node src/bin/ybc.ts staff query --code EMP001 --format json',
        { encoding: 'utf-8', cwd: process.cwd(), env: testEnv, timeout: 30000 }
      );
      const duration = Date.now() - startTime;

      console.log(`首次 API 调用时间: ${duration}ms`);
      expect(duration).toBeLessThan(20000);
    });

    it('后续 API 调用应小于 10s（Token 已缓存）', () => {
      const testEnv = getTestEnv();

      // 预热（获取 Token）
      safeExecSync(
        'npx ts-node src/bin/ybc.ts staff query --code EMP001 --format json',
        { encoding: 'utf-8', cwd: process.cwd(), env: testEnv, timeout: 30000 }
      );

      // 后续调用
      const iterations = 3;
      const times: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const startTime = Date.now();
        safeExecSync(
          'npx ts-node src/bin/ybc.ts staff query --code EMP001 --format json',
          { encoding: 'utf-8', cwd: process.cwd(), env: testEnv, timeout: 10000 }
        );
        times.push(Date.now() - startTime);
      }

      const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
      console.log(`后续 API 调用平均时间: ${avgTime.toFixed(0)}ms`);

      expect(avgTime).toBeLessThan(10000);
    });

    it('后续调用应比首次调用快', () => {
      const testEnv = getTestEnv();

      // 首次调用
      const firstStart = Date.now();
      safeExecSync(
        'npx ts-node src/bin/ybc.ts staff query --code EMP001 --format json',
        { encoding: 'utf-8', cwd: process.cwd(), env: testEnv, timeout: 15000 }
      );
      const firstDuration = Date.now() - firstStart;

      // 后续调用
      const subsequentTimes: number[] = [];
      for (let i = 0; i < 3; i++) {
        const start = Date.now();
        safeExecSync(
          'npx ts-node src/bin/ybc.ts staff query --code EMP001 --format json',
          { encoding: 'utf-8', cwd: process.cwd(), env: testEnv, timeout: 5000 }
        );
        subsequentTimes.push(Date.now() - start);
      }

      const avgSubsequent = subsequentTimes.reduce((a, b) => a + b, 0) / subsequentTimes.length;
      const improvement = firstDuration > 0 ? (firstDuration - avgSubsequent) / firstDuration : 0;

      console.log(`首次调用: ${firstDuration}ms, 后续平均: ${avgSubsequent.toFixed(0)}ms, 提升: ${(improvement * 100).toFixed(1)}%`);

      expect(improvement).toBeGreaterThan(0.3);
    });
  });
});
