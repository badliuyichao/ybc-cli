import { createProgram } from './program';
import { setupGlobalErrorHandler, ErrorHandler } from '../services/error';
import { registerConfigCommand } from './commands/config';
import { registerStaffApiCommands } from './commands/generated/staff';
import { registerTodoApiCommands } from './commands/generated/todo';

/**
 * CLI 启动函数
 *
 * 初始化 commander 程序并解析命令行参数
 */
export async function bootstrap(): Promise<void> {
  // 注册全局错误处理器
  // 从环境变量读取配置
  setupGlobalErrorHandler({
    quiet: process.env.YBC_QUIET === 'true',
    verbose: process.env.YBC_VERBOSE === 'true',
  });

  const program = createProgram();

  // 注册命令
  registerConfigCommand(program);

  // 注册生成的业务命令
  const staffCommand = program.command('staff').description('人员管理');
  registerStaffApiCommands(staffCommand);

  const todoCommand = program.command('todo').description('待办事项管理');
  registerTodoApiCommands(todoCommand);

  try {
    // 解析命令行参数
    program.parse(process.argv);
  } catch (error) {
    // 处理解析错误
    const errorHandler = ErrorHandler.getInstance();
    const exitCode = errorHandler.handle(error instanceof Error ? error : new Error(String(error)));
    process.exit(exitCode);
  }
}
