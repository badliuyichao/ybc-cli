/**
 * 创建待办
 *
 * 自动生成自 TodoApi.createTodo() （POST /todo/create）
 * 此文件由命令生成器自动生成，请勿手动修改
 *
 * 待办-001（2026-06-17）：使用 ApiHttpWrapper + handleErrorAndExit 模式
 * 待办-004（2026-06-17）：ApiClientService 注入（单进程内复用 cachedGatewayUrl）
 */

import { Command } from 'commander';
import { ApiHttpWrapper } from '../../../../services/api/api-http-wrapper';
import { ApiClientService } from '../../../../services/api/api-client-service';
import { OutputManager } from '../../../../cli/output';
import { handleErrorAndExit, BusinessError } from '../../../../services/error';

const outputManager = new OutputManager();

export function registerTodoApiCreateTodoCommand(parent: Command, apiClientService: ApiClientService) {
  parent
    .command('create')
    .description('创建待办')
    .option('--format <json|table|csv|raw>', '输出格式')
    .option('--raw', '仅输出服务端原始 JSON')
    .option('--verbose', '输出详细调试日志')
    .option('--todoCreateRequest <todoCreateRequest>', 'todoCreateRequest (JSON 字符串)')
    .action(async (options) => {
      try {
        const wrapper = new ApiHttpWrapper(apiClientService);
        const data = await wrapper.call({
          method: 'POST',
          path: '/todo/create',
          body: options.todoCreateRequest ? JSON.parse(options.todoCreateRequest) : undefined
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
