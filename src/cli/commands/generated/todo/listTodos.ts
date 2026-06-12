/**
 * 获取待办列表
 *
 * API 端点：GET /todo/list
 */
import { Command } from 'commander';
import { ApiHttpWrapper } from '../../../../services/api/api-http-wrapper';
import { OutputManager } from '../../../../cli/output';
import { handleErrorAndExit, BusinessError } from '../../../../services/error';

const outputManager = new OutputManager();

export function registerTodoApiListTodosCommand(parent: Command) {
  parent
    .command('list')
    .description('获取待办列表')
    .option('--status [status]', '待办状态')
    .option('--priority [priority]', '优先级')
    .option('--assignee [assignee]', '负责人')
    .option('--page [page]', '页码')
    .option('--pageSize [pageSize]', '每页数量')
    .action(async (options) => {
      try {
        const params: Record<string, string> = {};
        if (options.status) params.status = options.status;
        if (options.priority) params.priority = options.priority;
        if (options.assignee) params.assignee = options.assignee;
        if (options.page) params.page = options.page;
        if (options.pageSize) params.pageSize = options.pageSize;

        const wrapper = new ApiHttpWrapper();
        const data = await wrapper.call({
          method: 'GET',
          path: '/todo/list',
          params,
        });

        const responseData = data as { code?: string; message?: string };
        if (responseData.code && responseData.code !== 'SUCCESS' && responseData.code !== '00000') {
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
