/**
 * 创建待办
 *
 * API 端点：POST /todo/create
 */
import { Command } from 'commander';
import { ApiHttpWrapper } from '../../../../services/api/api-http-wrapper';
import { OutputManager } from '../../../../cli/output';
import { handleErrorAndExit, BusinessError } from '../../../../services/error';

const outputManager = new OutputManager();

export function registerTodoApiCreateTodoCommand(parent: Command) {
  parent
    .command('create')
    .description('创建待办')
    .option('--format <json|table|csv|raw>', '输出格式')
    .option('--raw', '仅输出服务端原始 JSON')
    .option('--verbose', '输出详细调试日志')
    .requiredOption('--title <title>', '待办标题')
    .option('--description [description]', '待办描述')
    .option('--priority [priority]', '优先级')
    .option('--assignee [assignee]', '负责人')
    .option('--dueDate [dueDate]', '截止日期')
    .action(async (options) => {
      try {
        const body: Record<string, string> = { title: options.title };
        if (options.description) body.description = options.description;
        if (options.priority) body.priority = options.priority;
        if (options.assignee) body.assignee = options.assignee;
        if (options.dueDate) body.dueDate = options.dueDate;

        const wrapper = new ApiHttpWrapper();
        const data = await wrapper.call({
          method: 'POST',
          path: '/todo/create',
          body,
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