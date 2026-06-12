import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';

/**
 * 从 package.json 读取当前版本号
 */
function getVersion(): string {
  try {
    const pkgPath = path.join(__dirname, '..', '..', 'package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    return pkg.version || '0.0.0';
  } catch {
    return '0.0.0';
  }
}

/**
 * 初始化 commander 程序
 *
 * @returns {Command} commander 程序实例
 */
export function createProgram(): Command {
  const program = new Command();

  program
    .name('ybc')
    .description('用友 BIP 命令行工具')
    .version(getVersion(), '-V, --version', '查看版本')
    .option('--format <json|table|csv|raw>', '输出格式', 'table')
    .option('--raw', '仅输出服务端原始 JSON')
    .option('--dry-run', '预览请求而不发送')
    .option('--verbose', '输出详细调试日志')
    .option('--no-color', '禁用颜色')
    .option('--no-update-check', '禁用启动时版本更新检查');

  return program;
}
