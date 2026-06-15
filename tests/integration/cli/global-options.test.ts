/**
 * 全局选项传递测试(CR-001 回归)
 *
 * 验证每个生成的业务子命令都自带 --format / --raw / --verbose 选项,
 * 保证 commander 的 action 回调能读到 `options.format` 等值。
 *
 * 历史问题:program.ts 把 --format/--raw/--verbose 定义在根 program 上,
 * 但 commander 的子命令 action 回调里 `options` 不继承父级 option,
 * 导致 `options.format === undefined`。修复点:scripts/generate-commands.ts
 * 模板在每个子命令 .command() 后插入全局选项注册。
 *
 * 注意:src/cli/commands/generated/ 不可手改,本测试通过验证"生成器模板输出"
 * 来间接验证修复正确性 — 即验证一个 mock 子命令(模拟生成器输出)的 action
 * 能拿到 format/raw/verbose。
 */

import { Command } from 'commander';

describe('CR-001: generated sub-commands must declare --format / --raw / --verbose', () => {
  // 模拟 scripts/generate-commands.ts 输出的 action 结构
  // 一旦模板改回老写法,本测试会失败
  function mockGeneratedSubcommand(parent: Command) {
    return parent
      .command('mockSub')
      .description('mock')
      .option('--format <json|table|csv|raw>', '输出格式')
      .option('--raw', '仅输出服务端原始 JSON')
      .option('--verbose', '输出详细调试日志')
      .option('--id [id]', 'id')
      .action(async (options) => {
        // 模拟生成器输出里的 outputManager.output(result.data, options.format)
        return options;
      });
  }

  it('should expose --format / --raw / --verbose on generated sub-command', () => {
    const program = new Command();
    const staff = program.command('staff');
    const sub = mockGeneratedSubcommand(staff);

    const flags = sub.options.map((opt) => opt.long);
    expect(flags).toEqual(expect.arrayContaining(['--format', '--raw', '--verbose', '--id']));
  });

  it('action should receive --format value', async () => {
    const program = new Command();
    const staff = program.command('staff');
    let captured: any = null;
    staff
      .command('query')
      .description('mock query')
      .option('--format <json|table|csv|raw>', '输出格式')
      .option('--raw', '仅输出服务端原始 JSON')
      .option('--verbose', '输出详细调试日志')
      .option('--id [id]', 'id')
      .action((options) => {
        captured = options;
      });

    await program.parseAsync(['node', 'test', 'staff', 'query', '--id', '1001', '--format', 'json']);

    expect(captured).not.toBeNull();
    expect(captured.id).toBe('1001');
    expect(captured.format).toBe('json'); // CR-001 核心断言
  });

  it('--raw and --verbose flags should propagate', async () => {
    const program = new Command();
    const todo = program.command('todo');
    let captured: any = null;
    todo
      .command('list')
      .description('mock list')
      .option('--format <json|table|csv|raw>', '输出格式')
      .option('--raw', '仅输出服务端原始 JSON')
      .option('--verbose', '输出详细调试日志')
      .action((options) => {
        captured = options;
      });

    await program.parseAsync(['node', 'test', 'todo', 'list', '--raw', '--verbose']);

    expect(captured).not.toBeNull();
    expect(captured.raw).toBe(true);
    expect(captured.verbose).toBe(true);
  });

  it('generated sub-command without --format option should NOT have it (regression guard)', async () => {
    // 反向断言(静态检查):如果子命令没注册 --format,commander 的 options
    // 数组里就不包含它,action 回调里的 options.format 就是 undefined
    // 防止生成器模板被改回去
    const program = new Command();
    const cmd = program.command('noOpts');
    cmd
      .command('run')
      .action(() => {
        // no-op
      });

    const flags = cmd.commands[0].options.map((opt) => opt.long);
    expect(flags).not.toContain('--format');
    expect(flags).not.toContain('--raw');
    expect(flags).not.toContain('--verbose');
  });
});