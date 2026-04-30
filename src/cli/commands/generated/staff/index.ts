/**
 * StaffApi 命令注册
 *
 * 自动生成自 StaffApi
 * 此文件由命令生成器自动生成，请勿手动修改
 */

import { Command } from 'commander';
import { registerStaffApiDisableStaffCommand } from './disableStaff';
import { registerStaffApiEnableStaffCommand } from './enableStaff';
import { registerStaffApiQueryStaffCommand } from './queryStaff';

export function registerStaffApiCommands(command: Command) {
  registerStaffApiDisableStaffCommand(command);
  registerStaffApiEnableStaffCommand(command);
  registerStaffApiQueryStaffCommand(command);
}
