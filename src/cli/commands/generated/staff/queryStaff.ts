/**
 * 查询员工详情
 *
 * API 端点：GET /yonbip/digitalModel/staff/detail
 * 参数：id 和 code 至少传其一
 */
import { Command } from 'commander';
import chalk from 'chalk';
import { ApiHttpWrapper } from '../../../../services/api/api-http-wrapper';
import { OutputManager } from '../../../../cli/output';
import { handleErrorAndExit, BusinessError } from '../../../../services/error';

const outputManager = new OutputManager();

export function registerStaffApiQueryStaffCommand(parent: Command) {
  parent
    .command('query')
    .description('查询员工详情（简版员工专用）')
    .option('--format <json|table|csv|raw>', '输出格式')
    .option('--raw', '仅输出服务端原始 JSON')
    .option('--verbose', '输出详细调试日志')
    .option('--id [id]', '员工 ID（id 和 code 至少传其一）')
    .option('--code [code]', '员工编码（id 和 code 至少传其一）')
    .action(async (options) => {
      if (!options.id && !options.code) {
        console.error(chalk.red('错误：id 和 code 参数至少需要传入一个'));
        console.log('');
        console.log('用法：ybc staff query --id <员工ID>');
        console.log('      ybc staff query --code <员工编码>');
        process.exit(1);
      }

      try {
        const params: Record<string, string> = {};
        if (options.id) params.id = options.id;
        if (options.code) params.code = options.code;

        const wrapper = new ApiHttpWrapper();
        const data = await wrapper.call({
          method: 'GET',
          path: '/yonbip/digitalModel/staff/detail',
          params,
        });

        const responseData = data as { code?: string; message?: string };
        if (responseData.code && responseData.code !== '200' && responseData.code !== '') {
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