/**
 * 创建待办
 *
 * 自动生成自 TodoApi.createTodo()
 * 此文件由命令生成器自动生成，请勿手动修改
 */

import { Command } from 'commander';
import axios from 'axios';
import { TodoApi } from '../../../../api/generated';
import { OutputManager } from '../../../../cli/output';
import { ApiClientService } from '../../../../services/api/api-client-service';
import { handleErrorAndExit, BusinessError } from '../../../../services/error';

const outputManager = new OutputManager();

export function registerTodoApiCreateTodoCommand(parent: Command) {
  parent
    .command('create')
    .description('创建待办')
    .requiredOption('--title <title>', '待办标题')
    .option('--description [description]', '待办描述')
    .option('--priority [priority]', 'priority')
    .option('--assignee [assignee]', 'assignee')
    .option('--dueDate [dueDate]', '截止日期')
    .action(async (options) => {
      try {
        // 获取配置好的 API 客户端（使用正确的 gatewayUrl）
        const apiClientService = new ApiClientService();
        const configuration = await apiClientService.getConfiguration();
        const api = new TodoApi(configuration);

        // 构建请求体
        const todoCreateRequest: any = {
          title: options.title,
        };
        if (options.description) todoCreateRequest.description = options.description;
        if (options.priority) todoCreateRequest.priority = options.priority;
        if (options.assignee) todoCreateRequest.assignee = options.assignee;
        if (options.dueDate) todoCreateRequest.dueDate = options.dueDate;

        const result = await api.createTodo(todoCreateRequest);

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