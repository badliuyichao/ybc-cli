/**
 * config set 命令
 *
 * 修改配置项
 *
 * CR-041 重构（2026-06-17）：所有错误改用 throw + 顶层 handleErrorAndExit 统一处理
 * （替代原 6 处直接 process.exit()）
 */

import { Command } from 'commander';
import { ConfigService } from '../../../services/config/config-service';
import { ValidationError } from '../../../services/error/errors';
import { handleErrorAndExit } from '../../../services/error/error-handler';
import { ConfigField } from '../../../types/config';
import chalk from 'chalk';

/**
 * 注册 config set 命令
 */
export function registerConfigSetCommand(program: Command): void {
  program
    .command('set <field> <value>')
    .description('修改配置项')
    .helpOption('-h, --help', '显示帮助信息')
    .addHelpText(
      'after',
      `
示例:
  $ ybc config set tenantId your-tenant-id
  $ ybc config set appKey your-app-key
  $ ybc config set appSecret your-app-secret
  $ ybc config set env production
  $ ybc config set format json

可用字段:
  tenantId    租户ID（必需）
  appKey      App Key（必需）
  appSecret   App Secret（必需，将加密存储）
  env         环境 (sandbox/production)
  format      输出格式 (json/table/csv/raw)
`
    )
    .action(async (field: string, value: string) => {
      try {
        const configService = new ConfigService();

        // 验证字段名
        const validFields: ConfigField[] = ['tenantId', 'appKey', 'appSecret', 'env', 'format'];
        if (!(validFields as string[]).includes(field)) {
          console.error(chalk.red(`❌ 无效的字段名: ${field}`));
          console.error();
          console.error('可用字段:');
          validFields.forEach((f: ConfigField) => {
            console.error(chalk.gray(`  • ${f}`));
          });
          console.error();
          throw new ValidationError(`无效的字段名: ${field}`, { field: 'field', value: field });
        }
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const fieldName: ConfigField = field as ConfigField;

        // 检查配置文件是否存在
        if (!(await configService.exists())) {
          console.log(chalk.yellow('⚠️  配置文件不存在'));
          console.log();
          console.log('请先运行以下命令初始化配置:');
          console.log(chalk.cyan('  ybc config init'));
          console.log();
          // CR-018 修正：env var 命名映射（appKey → YBC_APP_KEY, appSecret → YBC_APP_SECRET）
          const envVarName =
            fieldName === 'appKey'
              ? 'YBC_APP_KEY'
              : fieldName === 'appSecret'
                ? 'YBC_APP_SECRET'
                : `YBC_${field.toUpperCase()}`;
          console.log('或设置环境变量:');
          console.log(chalk.cyan(`  export ${envVarName}=<value>`));
          console.log();
          throw new ValidationError('配置文件不存在', { field: 'config' });
        }

        // 显示修改前的值
        const oldConfig = await configService.getConfig({
          decryptSensitive: true,
          maskSensitive: true,
        });

        console.log();
        console.log(chalk.bold('📝 修改配置'));
        console.log();

        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        const oldValue = oldConfig[fieldName];
        if (oldValue) {
          // CR-014 修正：appSecret 字段旧值标注"（已脱敏显示）"
          // 旧值可能是 string | boolean | object，统一用 String() 包装防止 [object Object]
          const oldValueStr = String(oldValue);
          const displayValue =
            fieldName === 'appSecret' ? `${oldValueStr}（已脱敏显示）` : oldValueStr;
          console.log(`  ${chalk.bold('字段')}      : ${field}`);
          console.log(`  ${chalk.bold('旧值')}      : ${displayValue}`);
          console.log(`  ${chalk.bold('新值')}      : ${value}`);
        } else {
          console.log(`  ${chalk.bold('字段')}      : ${field}`);
          console.log(`  ${chalk.bold('旧值')}      : ${chalk.gray('未设置')}`);
          console.log(`  ${chalk.bold('新值')}      : ${value}`);
        }

        console.log();

        // 显示字段说明
        if (fieldName === 'tenantId') {
          console.log(chalk.cyan('💡 设置租户ID（必需）'));
          console.log();
        } else if (fieldName === 'appKey') {
          console.log(chalk.cyan('💡 设置 App Key'));
          console.log();
        } else if (fieldName === 'appSecret') {
          console.log(chalk.cyan('💡 设置 App Secret'));
          console.log(chalk.yellow('⚠️  appSecret 将加密存储'));
          console.log();
        }

        // 更新配置
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        await configService.setConfig(fieldName, value);

        console.log(chalk.green('✅ 配置已更新'));
        console.log();

        // 显示更新后的配置
        console.log('运行以下命令查看完整配置:');
        console.log(chalk.cyan('  ybc config show'));
        console.log();
      } catch (error) {
        handleErrorAndExit(error instanceof Error ? error : new Error(String(error)));
      }
    });
}
