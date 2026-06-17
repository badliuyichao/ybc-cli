/**
 * ybc API 性能基准测试
 *
 * 用纯 HTTP 请求（不依赖项目代码）模拟完整鉴权 + 业务调用流程，
 * 输出各阶段耗时分位数，用于：
 *   1. 客观测量真实用友 API 性能（不被 mock/测试代码污染）
 *   2. 为 ROADMAP 待办-004（ApiClientService 注入）的 200-500ms 收益提供基线
 *   3. CI 性能回归检测
 *
 * 使用：
 *   YBC_TENANT_ID=xxx YBC_APP_KEY=xxx YBC_APP_SECRET=xxx \
 *     npx ts-node benchmarks/api-perf.ts
 *
 *   npx ts-node benchmarks/api-perf.ts --iterations 20 --code EMP001
 *
 * 不需要凭证也可跑：脚本会用 mock 模式（不真发请求，模拟各阶段耗时）。
 */

import * as crypto from 'crypto';
import axios, { AxiosInstance } from 'axios';
import { performance } from 'perf_hooks';

// ============================================================
// 配置
// ============================================================

interface PerfConfig {
  tenantId: string;
  appKey: string;
  appSecret: string;
  /** 业务 API 路径（默认 staff detail）*/
  staffCode: string;
  /** 迭代次数 */
  iterations: number;
  /** mock 模式（不真发请求，用于单元测试）*/
  mock: boolean;
  /** 数据中心 URL */
  dataCenterUrl: string;
  /** 业务 ID（id 和 code 至少传其一）*/
  staffId?: string;
}

function loadConfig(): PerfConfig {
  return {
    tenantId: process.env.YBC_TENANT_ID || 'mock-tenant',
    appKey: process.env.YBC_APP_KEY || 'mock-app-key-12345678',
    appSecret: process.env.YBC_APP_SECRET || 'mock-app-secret-12345678901234',
    staffCode: process.env.YBC_STAFF_CODE || 'EMP001',
    staffId: process.env.YBC_STAFF_ID,
    iterations: parseInt(
      process.argv.find((a) => a.startsWith('--iterations='))?.split('=')[1] || '10',
      10
    ),
    mock: process.argv.includes('--mock') || !process.env.YBC_TENANT_ID,
    dataCenterUrl: 'https://api.yonyoucloud.com',
  };
}

// ============================================================
// 类型
// ============================================================

interface StageTimings {
  /** 数据中心查询耗时（ms）*/
  dataCenter: number;
  /** Token 获取耗时（ms）*/
  token: number;
  /** 业务接口调用耗时（ms）*/
  business: number;
  /** 总耗时（ms）*/
  total: number;
}

interface IterationResult {
  iteration: number;
  success: boolean;
  error?: string;
  timings: StageTimings;
  /** Token 是否被缓存复用（第二次起 true）*/
  tokenCached: boolean;
}

// ============================================================
// 签名计算（与项目内 SignatureService 逻辑一致）
// ============================================================

function calculateSignature(appKey: string, timestamp: number, appSecret: string): string {
  const sortedKeys = ['appKey', 'timestamp'].sort();
  let signString = '';
  for (const key of sortedKeys) {
    signString += key + (key === 'timestamp' ? timestamp.toString() : appKey);
  }
  return crypto.createHmac('sha256', appSecret).update(signString, 'utf8').digest('base64');
}

// ============================================================
// 核心执行
// ============================================================

class ApiBenchmark {
  private http: AxiosInstance;
  private cachedToken?: string;
  private cachedGatewayUrl?: string;
  private cachedTokenUrl?: string;

  constructor(private config: PerfConfig) {
    this.http = axios.create({
      timeout: 30000,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  /**
   * 数据中心查询
   */
  private async queryDataCenter(): Promise<{ tokenUrl: string; gatewayUrl: string }> {
    if (this.cachedGatewayUrl && this.cachedTokenUrl) {
      return {
        tokenUrl: this.cachedTokenUrl,
        gatewayUrl: this.cachedGatewayUrl,
      };
    }

    if (this.config.mock) {
      // mock 模式：模拟 200ms 网络延迟
      await this.delay(200);
      this.cachedTokenUrl = 'https://mock-token.example.com/iuap-api-auth';
      this.cachedGatewayUrl = 'https://mock-gateway.example.com/iuap-api-gateway';
      return {
        tokenUrl: this.cachedTokenUrl,
        gatewayUrl: this.cachedGatewayUrl,
      };
    }

    const response = await this.http.get(`${this.config.dataCenterUrl}/open-auth/dataCenter/getGatewayAddress`, {
      params: { tenantId: this.config.tenantId },
    });
    if (response.data.code !== '00000') {
      throw new Error(`Data center query failed: ${response.data.message}`);
    }
    this.cachedTokenUrl = response.data.data.tokenUrl;
    this.cachedGatewayUrl = response.data.data.gatewayUrl;
    return response.data.data;
  }

  /**
   * 获取 Token
   */
  private async getToken(tokenUrl: string): Promise<string> {
    if (this.cachedToken) return this.cachedToken;

    if (this.config.mock) {
      await this.delay(150);
      this.cachedToken = `mock-token-${Date.now()}`;
      return this.cachedToken;
    }

    const timestamp = Date.now();
    const signature = calculateSignature(this.config.appKey, timestamp, this.config.appSecret);
    const response = await this.http.get(
      `${tokenUrl}/open-auth/selfAppAuth/base/v1/getAccessToken`,
      {
        params: { appKey: this.config.appKey, timestamp, signature },
      }
    );
    if (response.data.code !== '00000') {
      throw new Error(`Token request failed: ${response.data.message}`);
    }
    this.cachedToken = response.data.data.access_token;
    return this.cachedToken!;
  }

  /**
   * 业务 API 调用
   */
  private async callBusiness(gatewayUrl: string, token: string): Promise<unknown> {
    if (this.config.mock) {
      // mock 业务接口：模拟 300ms 延迟
      await this.delay(300);
      return { code: '200', data: { name: 'mock staff' } };
    }

    const params: Record<string, string> = { access_token: token };
    if (this.config.staffId) params.id = this.config.staffId;
    else params.code = this.config.staffCode;

    const response = await this.http.get(`${gatewayUrl}/yonbip/digitalModel/staff/detail`, {
      params,
    });
    if (response.data.code !== '200') {
      throw new Error(`Business API error: ${response.data.message || response.data.code}`);
    }
    return response.data;
  }

  /**
   * 单次完整流程
   */
  async runOnce(iteration: number): Promise<IterationResult> {
    const startTotal = performance.now();
    const tokenCachedBefore = !!this.cachedToken;

    try {
      // Stage 1: 数据中心查询
      const t1Start = performance.now();
      const { tokenUrl, gatewayUrl } = await this.queryDataCenter();
      const t1 = performance.now() - t1Start;

      // Stage 2: Token 获取
      const t2Start = performance.now();
      const token = await this.getToken(tokenUrl);
      const t2 = performance.now() - t2Start;

      // Stage 3: 业务调用
      const t3Start = performance.now();
      await this.callBusiness(gatewayUrl, token);
      const t3 = performance.now() - t3Start;

      const total = performance.now() - startTotal;
      return {
        iteration,
        success: true,
        tokenCached: tokenCachedBefore,
        timings: { dataCenter: t1, token: t2, business: t3, total },
      };
    } catch (error) {
      return {
        iteration,
        success: false,
        error: (error as Error).message,
        tokenCached: tokenCachedBefore,
        timings: { dataCenter: 0, token: 0, business: 0, total: performance.now() - startTotal },
      };
    }
  }

  /**
   * mock 延迟工具
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * 跑完所有迭代
   */
  async runAll(): Promise<IterationResult[]> {
    const results: IterationResult[] = [];
    for (let i = 1; i <= this.config.iterations; i++) {
      const result = await this.runOnce(i);
      results.push(result);
    }
    return results;
  }
}

// ============================================================
// 统计工具
// ============================================================

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.floor((p / 100) * sorted.length);
  return sorted[Math.min(idx, sorted.length - 1)];
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function formatMs(ms: number): string {
  return `${ms.toFixed(0).padStart(5)}ms`;
}

// ============================================================
// 报告输出
// ============================================================

function printReport(results: IterationResult[], config: PerfConfig): void {
  const successResults = results.filter((r) => r.success);
  const failedResults = results.filter((r) => !r.success);

  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║           ybc API 性能基准测试报告                          ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  console.log(`配置：`);
  console.log(`  模式:       ${config.mock ? 'MOCK (无真实 API 调用)' : 'REAL (调用真实 API)'}`);
  console.log(`  Tenant:     ${config.tenantId}`);
  console.log(`  App Key:    ${config.appKey.substring(0, 8)}****`);
  console.log(`  业务路径:   /yonbip/digitalModel/staff/detail`);
  console.log(`  业务参数:   ${config.staffId ? `id=${config.staffId}` : `code=${config.staffCode}`}`);
  console.log(`  迭代次数:   ${config.iterations}`);
  console.log('');

  if (failedResults.length > 0) {
    console.log(`❌ 失败: ${failedResults.length} / ${results.length}`);
    failedResults.forEach((r) => {
      console.log(`  - 第 ${r.iteration} 次: ${r.error}`);
    });
    console.log('');
  }

  if (successResults.length === 0) {
    console.log('⚠️  全部失败，无统计数据');
    return;
  }

  // 分阶段统计
  const dataCenterTimes = successResults.map((r) => r.timings.dataCenter);
  const tokenTimes = successResults.map((r) => r.timings.token);
  const businessTimes = successResults.map((r) => r.timings.business);
  const totalTimes = successResults.map((r) => r.timings.total);

  // 首次 vs 后续
  const firstResult = successResults[0];
  const cachedResults = successResults.slice(1);
  const cachedTimes = cachedResults.map((r) => r.timings.total);
  const firstTimes = [firstResult.timings.total];

  console.log('━'.repeat(70));
  console.log('耗时统计（毫秒）');
  console.log('━'.repeat(70));
  console.log(
    `${'阶段'.padEnd(12)} ${'次数'.padStart(6)} ${'min'.padStart(8)} ${'p50'.padStart(8)} ${'p95'.padStart(8)} ${'p99'.padStart(8)} ${'mean'.padStart(8)} ${'max'.padStart(8)}`
  );
  console.log('-'.repeat(70));

  const printRow = (label: string, values: number[]) => {
    console.log(
      `${label.padEnd(12)} ${values.length.toString().padStart(6)} ` +
        `${formatMs(Math.min(...values))} ${formatMs(percentile(values, 50))} ` +
        `${formatMs(percentile(values, 95))} ${formatMs(percentile(values, 99))} ` +
        `${formatMs(mean(values))} ${formatMs(Math.max(...values))}`
    );
  };

  printRow('数据中心', dataCenterTimes);
  printRow('Token', tokenTimes);
  printRow('业务', businessTimes);
  printRow('总', totalTimes);

  console.log('');
  console.log('━'.repeat(70));
  console.log('Token 缓存收益分析');
  console.log('━'.repeat(70));

  if (cachedResults.length > 0) {
    const firstMean = mean(firstTimes);
    const cachedMean = mean(cachedTimes);
    const saved = firstMean - cachedMean;
    const savedPct = ((saved / firstMean) * 100).toFixed(1);

    console.log(`  首次调用:   ${formatMs(firstMean)}  (含数据中心 + Token + 业务)`);
    console.log(`  后续平均:   ${formatMs(cachedMean)}  (Token 缓存命中，仅业务)`);
    console.log(`  节省:       ${formatMs(saved)}  (${savedPct}%)`);
    console.log('');
    console.log(`  💡 结论：`);
    if (saved > 200) {
      console.log(`     - 数据中心 + Token 阶段合计 ~${formatMs(saved)}`);
      console.log(`     - 这就是 ApiClientService 注入重构（待办-004）的实际收益`);
    } else {
      console.log(`     - 单进程多命令场景收益较小`);
      console.log(`     - 主要价值在 ybc batch / ybc shell 多命令场景`);
    }
  } else {
    console.log('  （需要 ≥2 次迭代才有对比数据）');
  }

  console.log('');
  console.log('━'.repeat(70));
  console.log('每次迭代明细');
  console.log('━'.repeat(70));
  console.log(
    `${'#'.padStart(4)} ${'Token缓存'.padEnd(8)} ${'数据中心'.padStart(10)} ${'Token'.padStart(10)} ${'业务'.padStart(10)} ${'总'.padStart(10)} ${'状态'.padStart(6)}`
  );
  console.log('-'.repeat(70));
  results.forEach((r) => {
    const status = r.success ? '✓' : '✗';
    console.log(
      `${r.iteration.toString().padStart(4)} ${(r.tokenCached ? 'HIT' : 'MISS').padEnd(8)} ` +
        `${formatMs(r.timings.dataCenter)} ${formatMs(r.timings.token)} ` +
        `${formatMs(r.timings.business)} ${formatMs(r.timings.total)} ${status.padStart(6)}`
    );
  });

  console.log('');
}

// ============================================================
// 入口
// ============================================================

async function main(): Promise<void> {
  const config = loadConfig();

  console.log('\n🚀 启动 ybc API 性能基准测试...');
  if (config.mock) {
    console.log('⚠️  未检测到 YBC_TENANT_ID 环境变量，使用 MOCK 模式');
    console.log('   （MOCK 模式不真发请求，用于本地调试/单元测试）');
    console.log('   设置环境变量以启用真实 API 测试：');
    console.log('   export YBC_TENANT_ID=xxx YBC_APP_KEY=xxx YBC_APP_SECRET=xxx');
  } else {
    console.log('✅ 检测到凭证，将调用真实用友 API');
  }

  const bench = new ApiBenchmark(config);
  const results = await bench.runAll();

  printReport(results, config);

  // 退出码：如有失败则非 0
  const hasFailures = results.some((r) => !r.success);
  process.exit(hasFailures ? 1 : 0);
}

main().catch((error) => {
  console.error('\n❌ 基准测试异常:', error);
  process.exit(2);
});
