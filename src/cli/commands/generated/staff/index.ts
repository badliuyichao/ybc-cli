/**
 * StaffApi 命令注册
 *
 * 自动生成自 StaffApi
 * 此文件由命令生成器自动生成，请勿手动修改
 *
 * 待办-004（2026-06-17）：ApiClientService 注入
 */

import { Command } from 'commander';
import { ApiClientService } from '../../../../services/api/api-client-service';
import { registerStaffApiDisableStaffCommand } from './disableStaff';
import { registerStaffApiEnableStaffCommand } from './enableStaff';
import { registerStaffApiQueryStaffCommand } from './queryStaff';

export function registerStaffApiCommands(command: Command, apiClientService: ApiClientService) {
  registerStaffApiDisableStaffCommand(command, apiClientService);
  registerStaffApiEnableStaffCommand(command, apiClientService);
  registerStaffApiQueryStaffCommand(command, apiClientService);
}
