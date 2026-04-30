/**
 * 获取待办列表
 *
 * 自动生成自 TodoApi.listTodos()
 * 此文件由命令生成器自动生成，请勿手动修改
 */

import { Command } from 'commander';
import axios from 'axios';
import { TodoApi } from '../../../../api/generated';
import { OutputManager } from '../../../../cli/output';
import { ApiClientService } from '../../../../services/api/api-client-service';
import { handleErrorAndExit, BusinessError } from '../../../../services/error';

const outputManager = new OutputManager();

export function registerTodoApiListTodosCommand(parent: Command) {
  parent
    .command('list')
    .description('获取待办列表')
    .option('--status [status]', 'status')
    .option('--priority [priority]', 'priority')
    .option('--assignee [assignee]', 'assignee')
    .option('--page [page]', 'page')
    .option('--pageSize [pageSize]', 'pageSize')
    .action(async (options) => {
      try {
        // 获取配置好的 API 客户端（使用正确的 gatewayUrl）
        const apiClientService = new ApiClientService();
        const configuration = await apiClientService.getConfiguration();
        const api = new TodoApi(configuration);

        const result = await api.listTodos(
          options.status,
          options.priority,
          options.assignee,
          options.page,
          options.pageSize
        );

        // 检查 API 响应是否包含错误
        const responseData = result.data as { code?: string; message?: string };
        if (responseData.code && responseData.code !== 'SUCCESS' && responseData.code !== '00000') {
          throw new BusinessError(responseData.message || '业务操作失败', {
            businessCode: responseData.code,
          });
        }

        // 输出结果
        outputManager.output(result.data, options.format);
      } catch (error) {
        // 检查是否是 axios 错误（非 2xx 响应）
        if (axios.isAxiosError(error) && error.response) {
          const responseData = error.response.data as { code?: string; message?: string; details?: unknown };
          // 如果是业务错误，抛出 BusinessError
          if (responseData.code && responseData.code !== 'SUCCESS' && responseData.code !== '00000') {
            handleErrorAndExit(
              new BusinessError(responseData.message || '业务操作失败', {
                businessCode: responseData.code,
                details: responseData.details,
              })
            );
            return;
          }
        }
        // 对于其他错误，使用通用错误处理
        handleErrorAndExit(error instanceof Error ? error : new Error(String(error)));
      }
    });
}