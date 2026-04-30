/**
 * config set 命令
 *
 * 修改配置项
 */

import { Command } from 'commander';
import { ConfigService } from '../../../services/config/config-service';
import { ValidationError } from '../../../services/error/errors';
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
    .action(async (field, value) => {
      try {
        const configService = new ConfigService();

        // 验证字段名
        const validFields = ['tenantId', 'appKey', 'appSecret', 'env', 'format'];
        if (!validFields.includes(field)) {
          console.error(chalk.red(`❌ 无效的字段名: ${field}`));
          console.error();
          console.error('可用字段:');
          validFields.forEach((f) => {
            console.error(chalk.gray(`  • ${f}`));
          });
          console.error();
          process.exit(1);
        }

        // 检查配置文件是否存在
        if (!(await configService.exists())) {
          console.log(chalk.yellow('⚠️  配置文件不存在'));
          console.log();
          console.log('请先运行以下命令初始化配置:');
          console.log(chalk.cyan('  ybc config init'));
          console.log();
          console.log('或设置环境变量:');
          console.log(chalk.cyan('  export YBC_${field.toUpperCase()}=<value>'));
          console.log();
          process.exit(1);
        }

        // 显示修改前的值
        const oldConfig = await configService.getConfig({
          decryptSensitive: true,
          maskSensitive: true,
        });

        console.log();
        console.log(chalk.bold('📝 修改配置'));
        console.log();

        const oldValue = oldConfig[field as keyof typeof oldConfig];
        if (oldValue) {
          console.log(`  ${chalk.bold('字段')}      : ${field}`);
          console.log(`  ${chalk.bold('旧值')}      : ${oldValue}`);
          console.log(`  ${chalk.bold('新值')}      : ${value}`);
        } else {
          console.log(`  ${chalk.bold('字段')}      : ${field}`);
          console.log(`  ${chalk.bold('旧值')}      : ${chalk.gray('未设置')}`);
          console.log(`  ${chalk.bold('新值')}      : ${value}`);
        }

        console.log();

        // 显示字段说明
        if (field === 'tenantId') {
          console.log(chalk.cyan('💡 设置租户ID（必需）'));
          console.log();
        } else if (field === 'appKey') {
          console.log(chalk.cyan('💡 设置 App Key'));
          console.log();
        } else if (field === 'appSecret') {
          console.log(chalk.cyan('💡 设置 App Secret'));
          console.log(chalk.yellow('⚠️  appSecret 将加密存储'));
          console.log();
        }

        // 更新配置
        await configService.setConfig(field as any, value);

        console.log(chalk.green('✅ 配置已更新'));
        console.log();

        // 显示更新后的配置
        console.log('运行以下命令查看完整配置:');
        console.log(chalk.cyan('  ybc config show'));
        console.log();
      } catch (error) {
        handleError(error);
      }
    });
}

/**
 * 处理错误
 */
function handleError(error: unknown): void {
  if (error instanceof ValidationError) {
    console.error(chalk.red(`❌ 验证失败: ${error.message}`));
    if (error.validationDetails.field) {
      console.error(chalk.gray(`   字段: ${error.validationDetails.field}`));
    }
    if (error.validationDetails.value) {
      console.error(chalk.gray(`   值: ${error.validationDetails.value}`));
    }
    console.error();
    process.exit(1);
  }

  if (error instanceof Error) {
    console.error(chalk.red(`❌ 更新配置失败: ${error.message}`));
    process.exit(1);
  }

  console.error(chalk.red('❌ 发生未知错误'));
  process.exit(1);
}
