/**
 * 初始化测试配置文件
 *
 * 运行此脚本创建 tests/config/test-credentials.json
 * 该文件包含真实凭证，已被 .gitignore 忽略，不会提交到 Git
 *
 * 使用方法：
 *   npx ts-node scripts/init-test-config.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';

const CONFIG_PATH = path.join(__dirname, '..', 'tests', 'config', 'test-credentials.json');
const EXAMPLE_PATH = path.join(__dirname, '..', 'tests', 'config', 'test-credentials.json.example');

async function askQuestion(rl: readline.Interface, question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer.trim());
    });
  });
}

async function main() {
  console.log('=== 初始化测试配置文件 ===\n');
  console.log('此配置文件用于 E2E 测试连接用友公有云 API');
  console.log('文件路径:', CONFIG_PATH);
  console.log('注意: 此文件已被 .gitignore 忽略，不会提交到 Git\n');

  // 检查是否已存在配置文件
  if (fs.existsSync(CONFIG_PATH)) {
    const existingConfig = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
    console.log('检测到已存在的配置文件:');
    console.log(`  tenantId: ${existingConfig.tenantId}`);
    console.log(`  appKey: ${existingConfig.appKey}`);
    console.log(`  appSecret: ${'*'.repeat(8)}...`);
    console.log('');

    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const overwrite = await askQuestion(rl, '是否覆盖现有配置? (y/N): ');
    rl.close();

    if (overwrite.toLowerCase() !== 'y') {
      console.log('已取消操作');
      return;
    }
    console.log('');
  }

  // 交互式输入配置
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  console.log('请输入用友 BIP 测试凭证:\n');

  const tenantId = await askQuestion(rl, 'Tenant ID: ');
  if (!tenantId) {
    console.log('错误: Tenant ID 不能为空');
    rl.close();
    process.exit(1);
  }

  const appKey = await askQuestion(rl, 'App Key: ');
  if (!appKey) {
    console.log('错误: App Key 不能为空');
    rl.close();
    process.exit(1);
  }

  const appSecret = await askQuestion(rl, 'App Secret: ');
  if (!appSecret) {
    console.log('错误: App Secret 不能为空');
    rl.close();
    process.exit(1);
  }

  const apiUrl = await askQuestion(rl, 'API URL (默认: https://api.yonyoucloud.com): ');
  rl.close();

  // 创建配置文件
  const config = {
    tenantId,
    appKey,
    appSecret,
    apiUrl: apiUrl || 'https://api.yonyoucloud.com',
  };

  // 确保目录存在
  const configDir = path.dirname(CONFIG_PATH);
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }

  // 写入配置文件
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2) + '\n');

  // 设置文件权限（仅当前用户可读写）
  try {
    fs.chmodSync(CONFIG_PATH, 0o600);
  } catch {
    // Windows 可能不支持 chmod，忽略
  }

  console.log('\n✅ 配置文件已创建:', CONFIG_PATH);
  console.log('✅ 文件权限已设置为 600');
  console.log('\n现在可以运行 E2E 测试:');
  console.log('  npm run test:e2e');
}

main().catch((error) => {
  console.error('初始化失败:', error);
  process.exit(1);
});
