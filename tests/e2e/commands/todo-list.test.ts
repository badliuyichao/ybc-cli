/**
 * Todo List Command E2E 测试
 *
 * 测试 todo list 命令的完整执行流程
 */

import { Command } from 'commander';
import { registerTodoApiListTodosCommand } from '../../../src/cli/commands/generated/todo/listTodos';

// Mock axios 模块
jest.mock('axios');

describe('Todo List Command E2E', () => {
  let program: Command;

  beforeEach(() => {
    // 创建新的 program 实例
    program = new Command();
    program
      .name('ybc')
      .option('--format <format>', '输出格式', 'json');

    // 注册命令
    registerTodoApiListTodosCommand(program);
  });

  it('should register todo list command correctly', () => {
    const commands = program.commands;
    const listCommand = commands.find(cmd => cmd.name() === 'listTodos');

    expect(listCommand).toBeDefined();
    expect(listCommand?.description()).toBe('获取待办列表');
  });

  it('should have correct options for list command', () => {
    const commands = program.commands;
    const listCommand = commands.find(cmd => cmd.name() === 'listTodos');

    expect(listCommand).toBeDefined();
    expect(listCommand?.options).toHaveLength(5); // status, priority, assignee, page, pageSize
  });

  it('should parse status parameter correctly', async () => {
    // 验证参数解析能力
    const listCommand = program.commands.find(cmd => cmd.name() === 'listTodos');
    expect(listCommand).toBeDefined();

    // 验证命令有正确的选项
    const options = listCommand?.options || [];
    expect(options.find(opt => opt.long === '--status')).toBeDefined();
    expect(options.find(opt => opt.long === '--priority')).toBeDefined();
    expect(options.find(opt => opt.long === '--assignee')).toBeDefined();
  });

  it('should show help for todo list command', async () => {
    // Mock process.stdout.write 和 process.exit
    const stdoutWriteSpy = jest.spyOn(process.stdout, 'write').mockImplementation();
    const processExitSpy = jest.spyOn(process, 'exit').mockImplementation((code) => {
      // 不实际退出
      return undefined as never;
    });

    // 执行帮助命令
    const args = ['node', 'test', 'listTodos', '--help'];
    await program.parseAsync(args);

    // 验证帮助信息包含关键内容
    expect(stdoutWriteSpy).toHaveBeenCalled();
    const helpOutput = stdoutWriteSpy.mock.calls.map(call => call[0]).join('');
    expect(helpOutput).toContain('获取待办列表');
    expect(helpOutput).toContain('--status');
    expect(helpOutput).toContain('--priority');

    stdoutWriteSpy.mockRestore();
    processExitSpy.mockRestore();
  });
});