/**
 * E2E 测试配置加载器
 *
 * 从环境变量或测试配置文件加载真实凭证
 * 用于 E2E 测试连接用友公有云 API
 */

import * as fs from 'fs';
import * as path from 'path';

export interface TestConfig {
  tenantId: string;
  appKey: string;
  appSecret: string;
  apiUrl?: string;
}

/**
 * 加载测试配置
 *
 * 优先级：
 * 1. 环境变量（推荐用于 CI/CD）
 * 2. 测试配置文件（推荐用于本地开发）
 *
 * @returns 测试配置
 * @throws 如果未找到测试配置则抛出错误
 */
export function loadTestConfig(): TestConfig {
  // 优先级 1: 环境变量
  if (process.env.YBC_TEST_TENANT_ID && process.env.YBC_TEST_APP_KEY && process.env.YBC_TEST_APP_SECRET) {
    return {
      tenantId: process.env.YBC_TEST_TENANT_ID,
      appKey: process.env.YBC_TEST_APP_KEY,
      appSecret: process.env.YBC_TEST_APP_SECRET,
      apiUrl: process.env.YBC_TEST_API_URL,
    };
  }

  // 优先级 2: 测试配置文件
  const configPath = path.join(__dirname, 'test-credentials.json');
  if (fs.existsSync(configPath)) {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    return {
      tenantId: config.tenantId,
      appKey: config.appKey,
      appSecret: config.appSecret,
      apiUrl: config.apiUrl,
    };
  }

  throw new Error(
    '未找到测试配置。\n' +
    '请通过以下方式之一配置：\n' +
    '1. 运行初始化脚本：npm run init:test-config\n' +
    '2. 手动创建配置文件：tests/config/test-credentials.json（参考 test-credentials.json.example）\n' +
    '3. 设置环境变量：YBC_TEST_TENANT_ID, YBC_TEST_APP_KEY, YBC_TEST_APP_SECRET'
  );
}

/**
 * 检查测试配置是否可用
 *
 * @returns 是否可用
 */
export function isTestConfigAvailable(): boolean {
  try {
    loadTestConfig();
    return true;
  } catch {
    return false;
  }
}
