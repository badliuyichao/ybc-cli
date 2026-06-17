import { createProgram } from './program';
import { setupGlobalErrorHandler, ErrorHandler } from '../services/error';
import { registerConfigCommand } from './commands/config';
import { registerStaffApiCommands } from './commands/generated/staff';
import { registerTodoApiCommands } from './commands/generated/todo';
import { UpdateChecker } from '../services/update';
import { ApiClientService } from '../services/api/api-client-service';

/**
 * CLI 启动函数
 *
 * 初始化 commander 程序并解析命令行参数
 */
export function bootstrap(): Promise<void> {
  // 包装异步逻辑到 Promise（CR-eslint: 替换 async 函数以消除无 await 警告）
  return new Promise<void>((resolve) => {
    // 注册全局错误处理器
    // 从环境变量读取配置
    setupGlobalErrorHandler({
      quiet: process.env.YBC_QUIET === 'true',
      verbose: process.env.YBC_VERBOSE === 'true',
    });

    const program = createProgram();

    // 注册命令
    registerConfigCommand(program);

    // 待办-004：ApiClientService 单例注入（单进程内 cachedGatewayUrl 复用）
    const apiClientService = new ApiClientService();

    // 注册生成的业务命令
    const staffCommand = program.command('staff').description('人员管理');
    registerStaffApiCommands(staffCommand, apiClientService);

    const todoCommand = program.command('todo').description('待办事项管理');
    registerTodoApiCommands(todoCommand, apiClientService);

    try {
      // 解析命令行参数
      program.parse(process.argv);

      // 异步检查版本更新（不阻塞 CLI 执行）
      const options = program.opts();
      if (!options.noUpdateCheck) {
        // 静默检查更新，不阻塞主流程
        UpdateChecker.checkForUpdates(true).catch(() => {
          // 静默失败
        });
      }
      resolve();
    } catch (error) {
      // 处理解析错误
      const errorHandler = ErrorHandler.getInstance();
      const exitCode = errorHandler.handle(
        error instanceof Error ? error : new Error(String(error))
      );
      process.exit(exitCode);
    }
  });
}
