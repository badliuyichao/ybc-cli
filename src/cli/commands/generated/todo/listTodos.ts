/**
 * 获取待办列表
 *
 * 自动生成自 TodoApi.listTodos() （GET /todo/list）
 * 此文件由命令生成器自动生成，请勿手动修改
 *
 * 待办-001（2026-06-17）：使用 ApiHttpWrapper + handleErrorAndExit 模式
 */

import { Command } from 'commander';
import { ApiHttpWrapper } from '../../../../services/api/api-http-wrapper';
import { OutputManager } from '../../../../cli/output';
import { handleErrorAndExit, BusinessError } from '../../../../services/error';

const outputManager = new OutputManager();

export function registerTodoApiListTodosCommand(parent: Command) {
  parent
    .command('listTodos')
    .description('获取待办列表')
    .option('--format <json|table|csv|raw>', '输出格式')
    .option('--raw', '仅输出服务端原始 JSON')
    .option('--verbose', '输出详细调试日志')
    .option('--status [status]', 'status')
    .option('--priority [priority]', 'priority')
    .option('--assignee [assignee]', 'assignee')
    .option('--page [page]', 'page')
    .option('--pageSize [pageSize]', 'pageSize')
    .action(async (options) => {
      try {
        const wrapper = new ApiHttpWrapper();
        const data = await wrapper.call({
          method: 'GET',
          path: '/todo/list',
          params: {
            status: options.status,
            priority: options.priority,
            assignee: options.assignee,
            page: options.page,
            pageSize: options.pageSize
          }
        });

        // CR-016: 统一业务成功码判断
        const responseData = data as { code?: string; message?: string };
        const successCodes = ['200', '00000', 'SUCCESS', ''];
        if (
          responseData.code &&
          !successCodes.includes(responseData.code)
        ) {
          throw new BusinessError(responseData.message || '业务操作失败', {
            businessCode: responseData.code,
          });
        }

        outputManager.output(responseData, options.format);
      } catch (error) {
        handleErrorAndExit(error instanceof Error ? error : new Error(String(error)));
      }
    });
}
