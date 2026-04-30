/**
 * config show 命令
 *
 * 显示当前配置
 */

import { Command } from 'commander';
import { ConfigService } from '../../../services/config/config-service';
import chalk from 'chalk';

/**
 * 隐藏敏感信息
 * 显示前几位和后几位，中间用星号代替
 */
function maskSecret(secret: string | undefined): string {
  if (!secret) return chalk.gray('未设置');
  if (secret.length <= 8) {
    // 如果太短，只显示前2位
    return secret.substring(0, 2) + '****';
  }
  // 显示前4位和后4位
  return `${secret.substring(0, 4)}****${secret.substring(secret.length - 4)}`;
}

/**
 * 注册 config show 命令
 */
export function registerConfigShowCommand(program: Command): void {
  program
    .command('show')
    .description('显示当前配置')
    .option('--json', '以 JSON 格式输出')
    .option('--reveal', '显示完整的 SK（谨慎使用）')
    .helpOption('-h, --help', '显示帮助信息')
    .action(async (options) => {
      try {
        const configService = new ConfigService();

        // 检查配置是否存在
        const configExists = await configService.exists();
        const hasEnvCredentials = process.env.YBC_TENANT_ID && process.env.YBC_APP_KEY && process.env.YBC_APP_SECRET;

        if (!configExists && !hasEnvCredentials) {
          console.log();
          console.log(chalk.yellow('⚠️  尚未配置'));
          console.log();
          console.log('请先运行以下命令初始化配置:');
          console.log(chalk.cyan('  ybc config init'));
          console.log();
          console.log('或设置环境变量:');
          console.log(chalk.cyan('  export YBC_TENANT_ID=<your-tenant-id>'));
          console.log(chalk.cyan('  export YBC_APP_KEY=<your-app-key>'));
          console.log(chalk.cyan('  export YBC_APP_SECRET=<your-app-secret>'));
          console.log();
          process.exit(1);
        }

        // 读取配置
        const config = await configService.getConfig({
          decryptSensitive: true,
          maskSensitive: !options.reveal,
        });

        if (options.json) {
          // JSON 格式输出
          console.log(JSON.stringify(config, null, 2));
        } else {
          // 表格格式输出
          console.log();
          console.log(chalk.bold('📋 当前配置'));
          console.log();

          // 显示来源
          if (hasEnvCredentials) {
            console.log(chalk.cyan('来源:'));
            console.log(chalk.gray('  • 环境变量'));
            if (configExists) {
              console.log(chalk.gray('  • 配置文件'));
            }
            console.log();
          }

          // 显示配置项
          console.log(chalk.cyan('配置项:'));
          console.log();

          // 租户ID
          if (config.tenantId) {
            console.log(`  ${chalk.bold('租户ID')}      : ${config.tenantId}`);
          } else {
            console.log(`  ${chalk.bold('租户ID')}      : ${chalk.gray('未设置')}`);
          }

          // App Key
          if (config.appKey) {
            console.log(`  ${chalk.bold('App Key')}     : ${config.appKey}`);
          } else {
            console.log(`  ${chalk.bold('App Key')}     : ${chalk.gray('未设置')}`);
          }

          // App Secret
          if (config.appSecret) {
            if (options.reveal) {
              console.log(`  ${chalk.bold('App Secret')}  : ${chalk.red(config.appSecret)}`);
              console.log();
              console.log(chalk.red('⚠️  警告: App Secret 已完整显示，请确保在安全环境中操作'));
            } else {
              console.log(`  ${chalk.bold('App Secret')}  : ${maskSecret(config.appSecret)}`);
              console.log();
              console.log(chalk.gray('💡 使用 --reveal 选项可显示完整密钥（谨慎使用）'));
            }
          } else {
            console.log(`  ${chalk.bold('App Secret')}  : ${chalk.gray('未设置')}`);
          }

          console.log();

          // 环境
          if (config.env) {
            console.log(`  ${chalk.bold('环境')}        : ${config.env}`);
          } else {
            console.log(`  ${chalk.bold('环境')}        : ${chalk.gray('未设置 (默认: sandbox)')}`);
          }

          // 输出格式
          if (config.format) {
            console.log(`  ${chalk.bold('输出格式')}    : ${config.format}`);
          } else {
            console.log(`  ${chalk.bold('输出格式')}    : ${chalk.gray('未设置 (默认: table)')}`);
          }

          console.log();

          // 显示数据中心域名信息
          if (config.dataCenter) {
            console.log(chalk.cyan('数据中心域名:'));
            console.log();
            if (config.dataCenter.tokenUrl) {
              console.log(`  ${chalk.bold('Token URL')}   : ${config.dataCenter.tokenUrl}`);
            } else {
              console.log(`  ${chalk.bold('Token URL')}   : ${chalk.gray('未设置')}`);
            }

            if (config.dataCenter.gatewayUrl) {
              console.log(`  ${chalk.bold('Gateway URL')} : ${config.dataCenter.gatewayUrl}`);
            } else {
              console.log(`  ${chalk.bold('Gateway URL')} : ${chalk.gray('未设置')}`);
            }

            if (config.dataCenter.lastUpdate) {
              console.log(
                `  ${chalk.bold('最后更新')}    : ${new Date(
                  config.dataCenter.lastUpdate
                ).toLocaleString('zh-CN')}`
              );
            } else {
              console.log(`  ${chalk.bold('最后更新')}    : ${chalk.gray('未知')}`);
            }

            console.log();
          }

          if (config.createdAt) {
            console.log(
              `  ${chalk.bold('创建时间')}    : ${new Date(config.createdAt).toLocaleString('zh-CN')}`
            );
          }

          if (config.updatedAt) {
            console.log(
              `  ${chalk.bold('更新时间')}    : ${new Date(config.updatedAt).toLocaleString('zh-CN')}`
            );
          }

          console.log();

          // 显示配置文件路径
          if (configExists) {
            console.log(chalk.cyan('配置文件:'));
            console.log(`  ${configService.getConfigFilePath()}`);
            console.log();
          }

          // 显示提示信息
          const hasCredentials = config.appKey && config.appSecret;
          if (!hasCredentials) {
            console.log(chalk.yellow('⚠️  配置不完整'));
            console.log();
            console.log('请运行以下命令完成配置:');
            console.log(chalk.cyan('  ybc config init'));
            console.log();
            console.log('或设置环境变量:');
            console.log(chalk.cyan('  export YBC_TENANT_ID=<your-tenant-id>'));
            console.log(chalk.cyan('  export YBC_APP_KEY=<your-app-key>'));
            console.log(chalk.cyan('  export YBC_APP_SECRET=<your-app-secret>'));
            console.log();
          } else {
            console.log(chalk.green('✅ 配置完整，可以正常使用'));
            console.log();
            console.log('下一步:');
            console.log(chalk.cyan('  ybc --help') + chalk.gray(' 查看可用命令'));
            console.log();
          }
        }
      } catch (error) {
        handleError(error);
      }
    });
}

/**
 * 处理错误
 */
function handleError(error: unknown): void {
  if (error instanceof Error) {
    console.error(`❌ 读取配置失败: ${error.message}`);
    process.exit(1);
  }

  console.error('❌ 发生未知错误');
  process.exit(1);
}
