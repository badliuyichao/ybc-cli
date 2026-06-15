/**
 * 获取待办列表
 *
 * 自动生成自 TodoApi.listTodos()
 * 此文件由命令生成器自动生成，请勿手动修改
 */

import { Command } from 'commander';
import { TodoApi } from '../../../../api/generated';
import { OutputManager } from '../../../../cli/output';
import { ApiClientService } from '../../../../services/api/api-client-service';

const outputManager = new OutputManager();
const apiClientService = new ApiClientService();

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
        // 获取配置好的 API 客户端（使用正确的 gatewayUrl）
        const configuration = await apiClientService.getConfiguration();
        const api = new TodoApi(configuration);
        const result = await api.listTodos(options.status, options.priority, options.assignee, options.page, options.pageSize);

        // 输出结果
        outputManager.output(result.data, options.format);
      } catch (error) {
        console.error('Error:', error);
        process.exit(1);
      }
    });
}
