/**
 * config init 命令
 *
 * 交互式初始化配置文件
 *
 * CR-041 重构（2026-06-17）：所有错误改用 throw + 顶层 handleErrorAndExit 统一处理
 * （替代原 7 处直接 process.exit()）
 */

import { Command } from 'commander';
import * as readline from 'readline';
import { ConfigService } from '../../../services/config/config-service';
import { ValidationError } from '../../../services/error/errors';
import { handleErrorAndExit } from '../../../services/error/error-handler';
import { Environment, OutputFormat } from '../../../types/config';

/**
 * 注册 config init 命令
 */
export function registerConfigInitCommand(program: Command): void {
  program
    .command('init')
    .description('交互式初始化配置文件')
    .option('--tenant-id <tenantId>', '租户ID')
    .option('--app-key <appKey>', 'App Key')
    .option('--app-secret <appSecret>', 'App Secret')
    .option('--env <environment>', '环境 (sandbox/production)', 'sandbox')
    .option('--format <format>', '输出格式 (json/table/csv/raw)', 'table')
    .option('--non-interactive', '非交互模式（从参数读取）')
    .helpOption('-h, --help', '显示帮助信息')
    .action(async (options) => {
      try {
        const configService = new ConfigService();

        // 检查配置是否已存在
        if (await configService.exists()) {
          console.log('⚠️  配置文件已存在');
          console.log('   如需重新初始化，请先删除配置文件:');
          console.log(`   ${configService.getConfigFilePath()}`);
          console.log();
          console.log('   或使用 "ybc config set" 命令修改配置项');
          throw new ValidationError('配置文件已存在', { field: 'config' });
        }

        let config: {
          tenantId: string;
          appKey: string;
          appSecret: string;
          env: Environment;
          format: OutputFormat;
        };

        if (options.nonInteractive) {
          // 非交互模式：从参数读取
          if (!options.tenantId || !options.appKey || !options.appSecret) {
            throw new ValidationError(
              '非交互模式需要提供 --tenant-id, --app-key 和 --app-secret 参数',
              { field: 'options' }
            );
          }

          config = {
            tenantId: options.tenantId,
            appKey: options.appKey,
            appSecret: options.appSecret,
            env: options.env || 'sandbox',
            format: options.format || 'table',
          };
        } else {
          // 交互模式：提示用户输入
          config = await promptConfig();
        }

        // 初始化配置
        await configService.init(config);

        console.log();
        console.log('✅ 配置初始化成功！');
        console.log();
        console.log('配置信息:');
        console.log(`  租户ID: ${config.tenantId}`);
        console.log(`  App Key: ${config.appKey.substring(0, 8)}****`);
        console.log(`  环境: ${config.env}`);
        console.log(`  输出格式: ${config.format}`);
        console.log();
        console.log(`配置文件路径: ${configService.getConfigFilePath()}`);
        console.log();
        console.log('🔒 App Secret 已加密存储');
        console.log();
        console.log('下一步：');
        console.log('  运行 "ybc config show" 查看完整配置');
        console.log('  运行 "ybc --help" 查看可用命令');
      } catch (error) {
        handleErrorAndExit(error instanceof Error ? error : new Error(String(error)));
      }
    });
}

/**
 * 交互式提示用户输入配置
 */
async function promptConfig(): Promise<{
  tenantId: string;
  appKey: string;
  appSecret: string;
  env: Environment;
  format: OutputFormat;
}> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const question = (prompt: string): Promise<string> => {
    return new Promise((resolve) => {
      rl.question(prompt, (answer) => {
        resolve(answer.trim());
      });
    });
  };

  const questionHidden = (prompt: string): Promise<string> => {
    return new Promise((resolve, reject) => {
      if (!process.stdin.isTTY) {
        reject(new Error('当前环境不支持隐藏输入（需要 TTY）。请使用 --non-interactive 模式。'));
        return;
      }

      process.stdout.write(prompt);
      process.stdin.setRawMode(true);
      process.stdin.resume();
      process.stdin.setEncoding('utf8');

      let password = '';
      const onData = (char: string) => {
        switch (char) {
          case '\n':
          case '\r':
          case '': // Ctrl+D
            process.stdin.setRawMode(false);
            process.stdin.pause();
            process.stdin.removeListener('data', onData); // CR-007: 清理监听器
            process.stdout.write('\n');
            resolve(password);
            break;
          case '': // Ctrl+C
            process.stdin.removeListener('data', onData);
            process.stdin.pause();
            reject(new Error('用户取消输入'));
            break;
          case '': // Backspace
          case '\b':
            password = password.slice(0, -1);
            process.stdout.clearLine(0);
            process.stdout.cursorTo(0);
            process.stdout.write(prompt + '*'.repeat(password.length));
            break;
          default:
            password += char;
            process.stdout.write('*');
            break;
        }
      };

      process.stdin.on('data', onData);
    });
  };

  try {
    console.log();
    console.log('🚀 欢迎使用用友 BIP CLI！');
    console.log();
    console.log('我们将引导您完成初始配置。');
    console.log('请输入您的租户ID、App Key 和 App Secret。');
    console.log();
    console.log('💡 如果您还没有这些信息，请访问用友 BIP 控制台创建。');
    console.log();

    // 提示输入 Tenant ID（第一个必需参数）
    let tenantId = '';
    while (!tenantId) {
      tenantId = await question('租户ID (Tenant ID): ');
      if (!tenantId) {
        console.log('❌ 租户ID不能为空');
      }
    }

    // 提示输入 App Key
    let appKey = '';
    while (!appKey) {
      appKey = await question('App Key: ');
      if (!appKey) {
        console.log('❌ App Key 不能为空');
      } else if (appKey.length < 16) {
        console.log('❌ App Key 长度至少16字符');
        appKey = '';
      }
    }

    // 提示输入 App Secret（隐藏输入）
    let appSecret = '';
    while (!appSecret) {
      appSecret = await questionHidden('App Secret: ');
      if (!appSecret) {
        console.log('❌ App Secret 不能为空');
      } else if (appSecret.length < 16) {
        console.log('❌ App Secret 长度至少16字符');
        appSecret = '';
      }
    }

    // 提示选择环境
    console.log();
    console.log('请选择环境:');
    console.log('  1. sandbox (沙箱环境，用于开发和测试)');
    console.log('  2. production (生产环境)');
    const envChoice = await question('选择环境 [1/2] (默认: 1): ');
    const env: Environment = envChoice === '2' ? 'production' : 'sandbox';

    // 提示选择输出格式
    console.log();
    console.log('请选择默认输出格式:');
    console.log('  1. table (表格格式，适合人类阅读)');
    console.log('  2. json (JSON 格式，适合机器处理)');
    console.log('  3. csv (CSV 格式，适合数据处理)');
    console.log('  4. raw (原始格式，输出服务端响应)');
    const formatChoice = await question('选择格式 [1/2/3/4] (默认: 1): ');
    let format: OutputFormat = 'table';
    switch (formatChoice) {
      case '2':
        format = 'json';
        break;
      case '3':
        format = 'csv';
        break;
      case '4':
        format = 'raw';
        break;
    }

    console.log();
    console.log('配置预览:');
    console.log(`  租户ID: ${tenantId}`);
    console.log(`  App Key: ${appKey.substring(0, 8)}****`);
    console.log(`  环境: ${env}`);
    console.log(`  输出格式: ${format}`);
    console.log();

    const confirm = await question('确认保存配置？ [Y/n]: ');
    if (confirm && confirm.toLowerCase() !== 'y' && confirm.toLowerCase() !== 'yes') {
      console.log('已取消配置');
      // 取消不视为错误，返回空让上层退出
      throw new ValidationError('用户取消配置', { field: 'confirm' });
    }

    return { tenantId, appKey, appSecret, env, format };
  } finally {
    rl.close();
  }
}
