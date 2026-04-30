#!/usr/bin/env node
/**
 * OpenAPI API 客户端生成脚本
 *
 * 此脚本使用 @openapitools/openapi-generator-cli 从 OpenAPI 规范文件生成 TypeScript Axios 客户端。
 *
 * 执行步骤：
 * 1. 验证 OpenAPI 规范文件是否存在
 * 2. 清理旧的生成文件
 * 3. 运行 OpenAPI Generator
 * 4. 验证生成结果
 */

import { execSync } from 'child_process';
import { existsSync, rmSync, mkdirSync } from 'fs';
import { join } from 'path';

// 配置
const OPENAPI_SPEC = join(__dirname, '..', 'openapi', 'openapi.yaml');
const GENERATOR_CONFIG = join(__dirname, '..', 'openapi', 'generator-config.yaml');
const OUTPUT_DIR = join(__dirname, '..', 'src', 'api', 'generated');

console.log('🚀 开始生成 API 客户端...\n');

// 步骤 1: 验证 OpenAPI 规范文件
console.log('📝 步骤 1: 验证 OpenAPI 规范文件');
if (!existsSync(OPENAPI_SPEC)) {
  console.error('❌ 错误: OpenAPI 规范文件不存在:', OPENAPI_SPEC);
  process.exit(1);
}
console.log('✅ OpenAPI 规范文件存在:', OPENAPI_SPEC);

// 验证生成器配置文件
if (!existsSync(GENERATOR_CONFIG)) {
  console.error('❌ 错误: 生成器配置文件不存在:', GENERATOR_CONFIG);
  process.exit(1);
}
console.log('✅ 生成器配置文件存在:', GENERATOR_CONFIG);
console.log();

// 步骤 2: 清理旧的生成文件
console.log('🧹 步骤 2: 清理旧的生成文件');
if (existsSync(OUTPUT_DIR)) {
  console.log('删除旧的生成目录:', OUTPUT_DIR);
  rmSync(OUTPUT_DIR, { recursive: true, force: true });
}
mkdirSync(OUTPUT_DIR, { recursive: true });
console.log('✅ 清理完成');
console.log();

// 步骤 3: 运行 OpenAPI Generator
console.log('⚙️  步骤 3: 运行 OpenAPI Generator');
try {
  // 使用配置文件的方式生成
  const command = `npx @openapitools/openapi-generator-cli generate -c ${GENERATOR_CONFIG}`;

  console.log('执行命令:', command);
  console.log();

  execSync(command, {
    stdio: 'inherit',
    cwd: join(__dirname, '..'),
  });

  console.log();
  console.log('✅ API 客户端生成成功');
} catch (error) {
  console.error('❌ 生成失败:', error);
  process.exit(1);
}
console.log();

// 步骤 4: 验证生成结果
console.log('🔍 步骤 4: 验证生成结果');
const generatedFiles = [
  join(OUTPUT_DIR, 'api.ts'),
  join(OUTPUT_DIR, 'base.ts'),
  join(OUTPUT_DIR, 'common.ts'),
  join(OUTPUT_DIR, 'configuration.ts'),
  join(OUTPUT_DIR, 'index.ts'),
];

let allFilesExist = true;
for (const file of generatedFiles) {
  if (existsSync(file)) {
    console.log('✅ 生成文件:', file);
  } else {
    console.error('❌ 缺失文件:', file);
    allFilesExist = false;
  }
}

if (!allFilesExist) {
  console.error('❌ 错误: 部分必需文件未生成');
  process.exit(1);
}

console.log();
console.log('🎉 API 客户端生成完成！');
console.log('📁 生成目录:', OUTPUT_DIR);
console.log();
console.log('下一步:');
console.log('  1. 检查生成的代码: src/api/generated/');
console.log('  2. 运行 TypeScript 编译测试: npm run build');
console.log('  3. 开始实现 Service 层和 CLI 层');