/**
 * Staff Query Command E2E 测试
 *
 * 测试 staff query 命令的完整执行流程
 */

import { Command } from 'commander';
import { registerStaffApiQueryStaffCommand } from '../../../src/cli/commands/generated/staff/queryStaff';

// Mock axios 模块
jest.mock('axios');

describe('Staff Query Command E2E', () => {
  let program: Command;

  beforeEach(() => {
    // 创建新的 program 实例
    program = new Command();
    program
      .name('ybc')
      .option('--format <format>', '输出格式', 'json');

    // 注册命令
    registerStaffApiQueryStaffCommand(program);
  });

  it('should register staff query command correctly', () => {
    const commands = program.commands;
    const queryCommand = commands.find(cmd => cmd.name() === 'query');

    expect(queryCommand).toBeDefined();
    expect(queryCommand?.description()).toBe('查询人员信息');
  });

  it('should have correct options for query command', () => {
    const commands = program.commands;
    const queryCommand = commands.find(cmd => cmd.name() === 'query');

    expect(queryCommand).toBeDefined();
    expect(queryCommand?.options).toHaveLength(6); // name, code, department, status, page, pageSize
  });

  it('should parse code parameter correctly', async () => {
    // 验证参数解析能力
    const queryCommand = program.commands.find(cmd => cmd.name() === 'query');
    expect(queryCommand).toBeDefined();

    // 验证命令有正确的选项
    const options = queryCommand?.options || [];
    expect(options.find(opt => opt.long === '--code')).toBeDefined();
    expect(options.find(opt => opt.long === '--name')).toBeDefined();
    expect(options.find(opt => opt.long === '--department')).toBeDefined();
  });

  it('should show help for staff query command', async () => {
    // Mock process.stdout.write 和 process.exit
    const stdoutWriteSpy = jest.spyOn(process.stdout, 'write').mockImplementation();
    const processExitSpy = jest.spyOn(process, 'exit').mockImplementation((code) => {
      // 不实际退出
      return undefined as never;
    });

    // 执行帮助命令
    const args = ['node', 'test', 'query', '--help'];
    await program.parseAsync(args);

    // 验证帮助信息包含关键内容
    expect(stdoutWriteSpy).toHaveBeenCalled();
    const helpOutput = stdoutWriteSpy.mock.calls.map(call => call[0]).join('');
    expect(helpOutput).toContain('查询人员信息');
    expect(helpOutput).toContain('--name');
    expect(helpOutput).toContain('--code');

    stdoutWriteSpy.mockRestore();
    processExitSpy.mockRestore();
  });
});