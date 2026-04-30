import { Command } from 'commander';

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
    .version('0.1.0', '-V, --version', '查看版本')
    .option('--format <json|table|csv>', '输出格式', 'table')
    .option('--raw', '仅输出服务端原始 JSON')
    .option('--dry-run', '预览请求而不发送')
    .option('--verbose', '输出详细调试日志')
    .option('--no-color', '禁用颜色')
    .option('--help-json', '输出 JSON Schema 格式的帮助信息');

  return program;
}
