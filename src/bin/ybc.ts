#!/usr/bin/env node

/**
 * ybc CLI 入口脚本
 *
 * 负责启动 commander 程序，处理全局错误
 */

import { bootstrap } from '../cli';

// 启动 CLI
bootstrap().catch((error: Error) => {
  console.error('CLI 启动失败:', error.message);
  process.exit(1);
});
