/**
 * CLI 启动时间单元测试
 *
 * 用途：
 *   测 dist 编译版（dist/bin/ybc.js）启动 < 1s，CI 自动守门启动性能回归。
 *
 * 来源（方案 C 重构，2026-06-17）：
 *   原 tests/e2e/scenarios/performance.test.ts 用 npx ts-node 测启动，
 *   但 ts-node 启动 ~40 秒（远高于 10s 阈值），掩盖真实性能。
 *   拆分后：
 *   - 启动性能 → 本文件（unit 测编译版，CI 跑，稳定）
 *   - API 性能 → benchmarks/api-perf.ts（手动跑，不污染 CI）
 *
 * 前置条件：
 *   跑前需执行 npm run build 生成 dist/bin/ybc.js
 *   如果 dist 不存在，测试自动跳过
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

const DIST_BIN = path.join(__dirname, '..', '..', '..', 'dist', 'bin', 'ybc.js');
const STARTUP_THRESHOLD_MS = 1000;

function measureStartupTime(args: string): number {
  const start = Date.now();
  execSync(`node "${DIST_BIN}" ${args}`, {
    encoding: 'utf-8',
    stdio: 'pipe',
    timeout: 5000,
  });
  return Date.now() - start;
}

const hasDistBuild = fs.existsSync(DIST_BIN);

const describeFn = hasDistBuild ? describe : describe.skip;

describeFn('CLI 启动性能（dist 编译版）', () => {
  it('--help 启动应小于 1s', () => {
    if (!hasDistBuild) return;

    // 跑 3 次取平均
    const times: number[] = [];
    for (let i = 0; i < 3; i++) {
      times.push(measureStartupTime('--help'));
    }
    const avg = times.reduce((a, b) => a + b, 0) / times.length;
    console.log(`--help 平均启动: ${avg.toFixed(0)}ms`);

    expect(avg).toBeLessThan(STARTUP_THRESHOLD_MS);
  });

  it('--version 启动应小于 1s', () => {
    if (!hasDistBuild) return;

    const times: number[] = [];
    for (let i = 0; i < 3; i++) {
      times.push(measureStartupTime('--version'));
    }
    const avg = times.reduce((a, b) => a + b, 0) / times.length;
    console.log(`--version 平均启动: ${avg.toFixed(0)}ms`);

    expect(avg).toBeLessThan(STARTUP_THRESHOLD_MS);
  });
});
