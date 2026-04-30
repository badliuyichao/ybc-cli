/**
 * 查询员工详情
 *
 * API 端点：/yonbip/digitalModel/staff/detail
 * 注意：用友 BIP API 需要 access_token 作为 query 参数，不支持 Authorization header
 */

import { Command } from 'commander';
import axios, { AxiosInstance } from 'axios';
import chalk from 'chalk';
import { OutputManager } from '../../../../cli/output';
import { ApiClientService } from '../../../../services/api/api-client-service';
import { handleErrorAndExit, BusinessError } from '../../../../services/error';

const outputManager = new OutputManager();

export function registerStaffApiQueryStaffCommand(parent: Command) {
  parent
    .command('query')
    .description('查询员工详情（简版员工专用）')
    .option('--id [id]', '员工 ID（id 和 code 至少传其一）')
    .option('--code [code]', '员工编码（id 和 code 至少传其一）')
    .action(async (options) => {
      // 验证参数：id 和 code 至少传其一
      if (!options.id && !options.code) {
        console.error(chalk.red('错误：id 和 code 参数至少需要传入一个'));
        console.log('');
        console.log('用法：ybc staff query --id <员工ID>');
        console.log('      ybc staff query --code <员工编码>');
        process.exit(1);
      }

      try {
        // 获取 API 客户端服务和配置
        const apiClientService = new ApiClientService();
        const config = await apiClientService.getConfiguration();

        // 创建 HTTP 客户端
        const httpClient: AxiosInstance = axios.create({
          baseURL: config.basePath,
          timeout: 30000,
        });

        // 构建请求参数（access_token 作为 query 参数）
        const params: Record<string, string> = {
          access_token: config.accessToken as string,
        };
        if (options.id) params.id = options.id;
        if (options.code) params.code = options.code;

        // 发送请求
        const response = await httpClient.get('/yonbip/digitalModel/staff/detail', { params });

        // 检查 API 响应是否包含错误
        const responseData = response.data as { code?: string; message?: string };
        if (responseData.code && responseData.code !== '200' && responseData.code !== '') {
          throw new BusinessError(responseData.message || '业务操作失败', {
            businessCode: responseData.code,
          });
        }

        // 输出结果
        outputManager.output(response.data, (options as any).format);
      } catch (error) {
        // 检查是否是 axios 错误（非 2xx 响应）
        if (axios.isAxiosError(error) && error.response) {
          const responseData = error.response.data as { code?: string; message?: string; details?: unknown };
          // 如果是业务错误，抛出 BusinessError
          if (responseData.code && responseData.code !== '200' && responseData.code !== '') {
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