/**
 * config 命令组入口
 *
 * 管理配置文件和配置项
 */

import { Command } from 'commander';
import { registerConfigInitCommand } from './init';
import { registerConfigShowCommand } from './show';
import { registerConfigSetCommand } from './set';

/**
 * 注册 config 命令组
 */
export function registerConfigCommand(program: Command): void {
  const configCommand = program
    .command('config')
    .description('管理 CLI 配置')
    .helpOption('-h, --help', '显示帮助信息');

  // 注册子命令
  registerConfigInitCommand(configCommand);
  registerConfigShowCommand(configCommand);
  registerConfigSetCommand(configCommand);
}
