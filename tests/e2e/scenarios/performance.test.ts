/**
 * 性能测试场景
 *
 * 测试场景：
 * - CLI 启动时间 <500ms
 * - 首次 API 调用 <2s
 * - 后续 API 调用 <1s（token 已缓存）
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { execSync } from 'child_process';
import { MockBipServer } from '../../mocks/mock-bip-server';

describe('Performance Scenarios (E2E)', () => {
  const tempDir = path.join(os.tmpdir(), 'ybc-perf-test-' + Date.now());
  const configPath = path.join(tempDir, '.ybc', 'config.json');
  const tokenPath = path.join(tempDir, '.ybc', 'token.json');
  let mockServer: MockBipServer;

  beforeAll(async () => {
    // 创建临时目录
    fs.mkdirSync(tempDir, { recursive: true });

    // 启动 Mock Server
    mockServer = new MockBipServer({ port: 4002 });
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

  describe('场景 1：CLI 启动时间测试', () => {
    it('CLI 启动时间应小于 500ms (--help)', async () => {
      const iterations = 5;
      const times: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const startTime = Date.now();

        try {
          execSync('npx ts-node src/bin/ybc.ts --help', {
            encoding: 'utf-8',
            cwd: process.cwd(),
            timeout: 5000,
          });
        } catch (error) {
          // help 可能导致 process.exit(0)，这是正常的
        }

        const endTime = Date.now();
        times.push(endTime - startTime);
      }

      const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
      const maxTime = Math.max(...times);

      console.log(`CLI 启动时间统计:`);
      console.log(`  平均: ${avgTime.toFixed(0)}ms`);
      console.log(`  最大: ${maxTime}ms`);
      console.log(`  最小: ${Math.min(...times)}ms`);
      console.log(`  所有: ${times.join(', ')}ms`);

      // 验证平均时间 < 500ms
      expect(avgTime).toBeLessThan(500);

      // 验证最大时间 < 800ms（允许一定的波动）
      expect(maxTime).toBeLessThan(800);
    });

    it('CLI 启动时间应小于 500ms (--version)', async () => {
      const iterations = 5;
      const times: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const startTime = Date.now();

        try {
          execSync('npx ts-node src/bin/ybc.ts --version', {
            encoding: 'utf-8',
            cwd: process.cwd(),
            timeout: 5000,
          });
        } catch (error) {
          // version 可能导致 process.exit(0)，这是正常的
        }

        const endTime = Date.now();
        times.push(endTime - startTime);
      }

      const avgTime = times.reduce((a, b) => a + b, 0) / times.length;

      console.log(`CLI --version 启动时间统计:`);
      console.log(`  平均: ${avgTime.toFixed(0)}ms`);
      console.log(`  所有: ${times.join(', ')}ms`);

      // 验证平均时间 < 500ms
      expect(avgTime).toBeLessThan(500);
    });

    it('CLI 启动时间应小于 500ms (config --help)', async () => {
      const iterations = 5;
      const times: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const startTime = Date.now();

        try {
          execSync('npx ts-node src/bin/ybc.ts config --help', {
            encoding: 'utf-8',
            cwd: process.cwd(),
            timeout: 5000,
          });
        } catch (error) {
          // help 可能导致 process.exit(0)，这是正常的
        }

        const endTime = Date.now();
        times.push(endTime - startTime);
      }

      const avgTime = times.reduce((a, b) => a + b, 0) / times.length;

      console.log(`CLI config --help 启动时间统计:`);
      console.log(`  平均: ${avgTime.toFixed(0)}ms`);
      console.log(`  所有: ${times.join(', ')}ms`);

      // 验证平均时间 < 500ms
      expect(avgTime).toBeLessThan(500);
    });
  });

  describe('场景 2：首次 API 调用性能测试', () => {
    it('首次 API 调用应小于 2s（包含 token 获取）', async () => {
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

      // 2. 首次 API 调用（无 token 缓存）
      const startTime = Date.now();

      const result = execSync('npx ts-node src/bin/ybc.ts staff query --code EMP001 --format json', {
        encoding: 'utf-8',
        cwd: process.cwd(),
        env: testEnv,
        timeout: 5000,
      });

      const endTime = Date.now();
      const duration = endTime - startTime;

      console.log(`首次 API 调用时间: ${duration}ms`);

      // 3. 验证结果
      expect(result).toContain('EMP001');
      expect(duration).toBeLessThan(2000);

      // 4. 验证 token 已缓存
      expect(fs.existsSync(tokenPath)).toBe(true);
    });

    it('首次 API 调用（多个并发）性能测试', async () => {
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

      // 2. 并发首次 API 调用
      const iterations = 3;
      const times: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const startTime = Date.now();

        const result = execSync(
          `npx ts-node src/bin/ybc.ts staff query --code EMP00${i + 1} --format json`,
          {
            encoding: 'utf-8',
            cwd: process.cwd(),
            env: testEnv,
            timeout: 5000,
          }
        );

        const endTime = Date.now();
        times.push(endTime - startTime);

        expect(result).toContain(`EMP00${i + 1}`);
      }

      const avgTime = times.reduce((a, b) => a + b, 0) / times.length;

      console.log(`首次 API 调用（并发）统计:`);
      console.log(`  平均: ${avgTime.toFixed(0)}ms`);
      console.log(`  所有: ${times.join(', ')}ms`);

      // 验证平均时间 < 2s
      expect(avgTime).toBeLessThan(2000);
    });
  });

  describe('场景 3：后续 API 调用性能测试（token 已缓存）', () => {
    it('后续 API 调用应小于 1s（token 已缓存）', async () => {
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

      // 2. 首次调用（获取 token）
      const firstResult = execSync(
        'npx ts-node src/bin/ybc.ts staff query --code EMP001 --format json',
        {
          encoding: 'utf-8',
          cwd: process.cwd(),
          env: testEnv,
          timeout: 5000,
        }
      );

      expect(firstResult).toContain('EMP001');
      expect(fs.existsSync(tokenPath)).toBe(true);

      // 3. 后续调用（使用缓存 token）
      const iterations = 5;
      const times: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const startTime = Date.now();

        const result = execSync(
          'npx ts-node src/bin/ybc.ts staff query --code EMP001 --format json',
          {
            encoding: 'utf-8',
            cwd: process.cwd(),
            env: testEnv,
            timeout: 5000,
          }
        );

        const endTime = Date.now();
        times.push(endTime - startTime);

        expect(result).toContain('EMP001');
      }

      const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
      const maxTime = Math.max(...times);

      console.log(`后续 API 调用（token 已缓存）统计:`);
      console.log(`  平均: ${avgTime.toFixed(0)}ms`);
      console.log(`  最大: ${maxTime}ms`);
      console.log(`  最小: ${Math.min(...times)}ms`);
      console.log(`  所有: ${times.join(', ')}ms`);

      // 验证平均时间 < 1s
      expect(avgTime).toBeLessThan(1000);

      // 验证最大时间 < 1.5s（允许一定的波动）
      expect(maxTime).toBeLessThan(1500);
    });

    it('后续 API 调用应比首次调用快 50% 以上', async () => {
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

      // 2. 首次调用（获取 token）
      const firstStartTime = Date.now();

      const firstResult = execSync(
        'npx ts-node src/bin/ybc.ts staff query --code EMP001 --format json',
        {
          encoding: 'utf-8',
          cwd: process.cwd(),
          env: testEnv,
          timeout: 5000,
        }
      );

      const firstEndTime = Date.now();
      const firstDuration = firstEndTime - firstStartTime;

      expect(firstResult).toContain('EMP001');

      // 3. 后续调用（使用缓存 token）
      const subsequentTimes: number[] = [];

      for (let i = 0; i < 3; i++) {
        const startTime = Date.now();

        const result = execSync(
          'npx ts-node src/bin/ybc.ts staff query --code EMP001 --format json',
          {
            encoding: 'utf-8',
            cwd: process.cwd(),
            env: testEnv,
            timeout: 5000,
          }
        );

        const endTime = Date.now();
        subsequentTimes.push(endTime - startTime);

        expect(result).toContain('EMP001');
      }

      const avgSubsequentTime =
        subsequentTimes.reduce((a, b) => a + b, 0) / subsequentTimes.length;

      console.log(`性能对比:`);
      console.log(`  首次调用: ${firstDuration}ms`);
      console.log(`  后续调用平均: ${avgSubsequentTime.toFixed(0)}ms`);
      console.log(`  性能提升: ${(((firstDuration - avgSubsequentTime) / firstDuration) * 100).toFixed(1)}%`);

      // 验证后续调用比首次调用快 50% 以上
      const improvement = (firstDuration - avgSubsequentTime) / firstDuration;
      expect(improvement).toBeGreaterThan(0.5);
    });
  });

  describe('场景 4：Token 刷新性能测试', () => {
    it('Token 刷新对用户体验的影响应小于 200ms', async () => {
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

      // 2. 首次调用获取基准时间
      const baselineStartTime = Date.now();

      const baselineResult = execSync(
        'npx ts-node src/bin/ybc.ts staff query --code EMP001 --format json',
        {
          encoding: 'utf-8',
          cwd: process.cwd(),
          env: testEnv,
          timeout: 5000,
        }
      );

      const baselineEndTime = Date.now();
      const baselineDuration = baselineEndTime - baselineStartTime;

      expect(baselineResult).toContain('EMP001');

      // 3. 创建即将过期的 token
      const expiresAt = Date.now() + 4 * 60 * 1000; // 4分钟后过期
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

      // 4. 执行调用（应该自动刷新 token）
      const refreshStartTime = Date.now();

      const refreshResult = execSync(
        'npx ts-node src/bin/ybc.ts staff query --code EMP001 --format json',
        {
          encoding: 'utf-8',
          cwd: process.cwd(),
          env: testEnv,
          timeout: 5000,
        }
      );

      const refreshEndTime = Date.now();
      const refreshDuration = refreshEndTime - refreshStartTime;

      expect(refreshResult).toContain('EMP001');

      // 5. 验证 token 已刷新
      const tokenData = JSON.parse(fs.readFileSync(tokenPath, 'utf-8'));
      expect(tokenData.access_token).not.toBe(initialToken);

      // 6. 计算刷新开销
      const refreshOverhead = refreshDuration - baselineDuration;

      console.log(`Token 刷新性能:`);
      console.log(`  基准调用时间: ${baselineDuration}ms`);
      console.log(`  刷新时调用时间: ${refreshDuration}ms`);
      console.log(`  刷新开销: ${refreshOverhead}ms`);

      // 验证刷新开销 < 200ms
      expect(refreshOverhead).toBeLessThan(200);
    });
  });

  describe('场景 5：命令响应时间分布测试', () => {
    it('staff query 命令响应时间应稳定在 1s 内', async () => {
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

      // 2. 预热（获取 token）
      execSync('npx ts-node src/bin/ybc.ts staff query --code EMP001 --format json', {
        encoding: 'utf-8',
        cwd: process.cwd(),
        env: testEnv,
        timeout: 5000,
      });

      // 3. 执行多次调用，收集响应时间
      const iterations = 10;
      const times: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const startTime = Date.now();

        execSync('npx ts-node src/bin/ybc.ts staff query --code EMP001 --format json', {
          encoding: 'utf-8',
          cwd: process.cwd(),
          env: testEnv,
          timeout: 5000,
        });

        const endTime = Date.now();
        times.push(endTime - startTime);
      }

      // 4. 计算统计数据
      const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
      const maxTime = Math.max(...times);
      const minTime = Math.min(...times);
      const sortedTimes = [...times].sort((a, b) => a - b);
      const p50 = sortedTimes[Math.floor(iterations * 0.5)];
      const p95 = sortedTimes[Math.floor(iterations * 0.95)];
      const p99 = sortedTimes[Math.floor(iterations * 0.99)];

      // 5. 计算标准差
      const variance = times.reduce((sum, time) => sum + Math.pow(time - avgTime, 2), 0) / iterations;
      const stdDev = Math.sqrt(variance);

      console.log(`staff query 命令响应时间分布:`);
      console.log(`  平均: ${avgTime.toFixed(0)}ms`);
      console.log(`  最小: ${minTime}ms`);
      console.log(`  最大: ${maxTime}ms`);
      console.log(`  P50: ${p50}ms`);
      console.log(`  P95: ${p95}ms`);
      console.log(`  P99: ${p99}ms`);
      console.log(`  标准差: ${stdDev.toFixed(0)}ms`);
      console.log(`  所有: ${times.join(', ')}ms`);

      // 6. 验证性能指标
      expect(avgTime).toBeLessThan(1000); // 平均 < 1s
      expect(p95).toBeLessThan(1200); // P95 < 1.2s
      expect(stdDev).toBeLessThan(200); // 标准差 < 200ms（稳定性）
    });

    it('config 命令响应时间应稳定在 500ms 内', async () => {
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
      };

      // 2. 执行多次调用，收集响应时间
      const iterations = 10;
      const times: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const startTime = Date.now();

        execSync('npx ts-node src/bin/ybc.ts config show', {
          encoding: 'utf-8',
          cwd: process.cwd(),
          env: testEnv,
          timeout: 5000,
        });

        const endTime = Date.now();
        times.push(endTime - startTime);
      }

      // 3. 计算统计数据
      const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
      const maxTime = Math.max(...times);
      const minTime = Math.min(...times);

      console.log(`config show 命令响应时间分布:`);
      console.log(`  平均: ${avgTime.toFixed(0)}ms`);
      console.log(`  最小: ${minTime}ms`);
      console.log(`  最大: ${maxTime}ms`);
      console.log(`  所有: ${times.join(', ')}ms`);

      // 4. 验证性能指标
      expect(avgTime).toBeLessThan(500); // 平均 < 500ms
      expect(maxTime).toBeLessThan(800); // 最大 < 800ms
    });
  });
});