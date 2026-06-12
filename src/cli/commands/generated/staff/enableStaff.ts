/**
 * 启用员工
 *
 * API 端点：POST /staff/{id}/enable
 */
import { Command } from 'commander';
import { ApiHttpWrapper } from '../../../../services/api/api-http-wrapper';
import { OutputManager } from '../../../../cli/output';
import { handleErrorAndExit, BusinessError } from '../../../../services/error';

const outputManager = new OutputManager();

export function registerStaffApiEnableStaffCommand(parent: Command) {
  parent
    .command('enable')
    .description('启用员工')
    .requiredOption('--id <id>', '员工 ID')
    .action(async (options) => {
      try {
        const wrapper = new ApiHttpWrapper();
        const data = await wrapper.call({
          method: 'POST',
          path: `/staff/${options.id}/enable`,
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
