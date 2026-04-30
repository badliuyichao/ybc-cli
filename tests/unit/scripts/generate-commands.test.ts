/**
 * 命令生成器单元测试
 *
 * 测试 generate-commands.ts 脚本的功能
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

describe('Command Generator', () => {
  const generatedDir = join(__dirname, '..', '..', '..', 'src', 'cli', 'commands', 'generated');

  beforeAll(() => {
    // 验证生成目录存在
    if (!existsSync(generatedDir)) {
      throw new Error('Generated commands directory does not exist. Run npm run generate:commands first.');
    }
  });

  describe('Staff Commands', () => {
    const staffDir = join(generatedDir, 'staff');

    it('should generate staff directory', () => {
      expect(existsSync(staffDir)).toBe(true);
    });

    it('should generate query command', () => {
      const queryFile = join(staffDir, 'queryStaff.ts');
      expect(existsSync(queryFile)).toBe(true);

      const content = readFileSync(queryFile, 'utf-8');
      // 使用 axios 直接调用 API（access_token 作为 query 参数）
      expect(content).toContain('axios');
      expect(content).toContain('ApiClientService');
      expect(content).toContain('员工详情');
      expect(content).toContain('.command(\'query\')');
    });

    it('should generate enable command', () => {
      const enableFile = join(staffDir, 'enableStaff.ts');
      expect(existsSync(enableFile)).toBe(true);

      const content = readFileSync(enableFile, 'utf-8');
      expect(content).toContain('StaffApi');
      expect(content).toContain('enableStaff');
      expect(content).toContain('启用员工');
      expect(content).toContain('.command(\'enable\')');
    });

    it('should generate disable command', () => {
      const disableFile = join(staffDir, 'disableStaff.ts');
      expect(existsSync(disableFile)).toBe(true);

      const content = readFileSync(disableFile, 'utf-8');
      expect(content).toContain('StaffApi');
      expect(content).toContain('disableStaff');
      expect(content).toContain('禁用员工');
      expect(content).toContain('.command(\'disable\')');
    });

    it('should generate staff index file', () => {
      const indexFile = join(staffDir, 'index.ts');
      expect(existsSync(indexFile)).toBe(true);

      const content = readFileSync(indexFile, 'utf-8');
      expect(content).toContain('registerStaffApiCommands');
      expect(content).toContain('registerStaffApiQueryStaffCommand');
      expect(content).toContain('registerStaffApiEnableStaffCommand');
      expect(content).toContain('registerStaffApiDisableStaffCommand');
    });
  });

  describe('Todo Commands', () => {
    const todoDir = join(generatedDir, 'todo');

    it('should generate todo directory', () => {
      expect(existsSync(todoDir)).toBe(true);
    });

    it('should generate create command', () => {
      const createFile = join(todoDir, 'createTodo.ts');
      expect(existsSync(createFile)).toBe(true);

      const content = readFileSync(createFile, 'utf-8');
      expect(content).toContain('TodoApi');
      expect(content).toContain('createTodo');
      expect(content).toContain('创建待办');
      expect(content).toContain('.command(\'create\')');
    });

    it('should generate list command', () => {
      const listFile = join(todoDir, 'listTodos.ts');
      expect(existsSync(listFile)).toBe(true);

      const content = readFileSync(listFile, 'utf-8');
      expect(content).toContain('TodoApi');
      expect(content).toContain('listTodos');
      expect(content).toContain('获取待办列表');
    });

    it('should generate todo index file', () => {
      const indexFile = join(todoDir, 'index.ts');
      expect(existsSync(indexFile)).toBe(true);

      const content = readFileSync(indexFile, 'utf-8');
      expect(content).toContain('registerTodoApiCommands');
      expect(content).toContain('registerTodoApiCreateTodoCommand');
      expect(content).toContain('registerTodoApiListTodosCommand');
    });
  });

  describe('Command Structure', () => {
    it('should import Commander correctly', () => {
      const queryFile = join(generatedDir, 'staff', 'queryStaff.ts');
      const content = readFileSync(queryFile, 'utf-8');
      expect(content).toContain('import { Command } from \'commander\'');
    });

    it('should import API client correctly', () => {
      const queryFile = join(generatedDir, 'staff', 'queryStaff.ts');
      const content = readFileSync(queryFile, 'utf-8');
      // 使用 ApiClientService 直接获取配置，然后使用 axios
      expect(content).toContain('import { ApiClientService }');
      expect(content).toContain('axios');
    });

    it('should import OutputManager correctly', () => {
      const queryFile = join(generatedDir, 'staff', 'queryStaff.ts');
      const content = readFileSync(queryFile, 'utf-8');
      expect(content).toContain('import { OutputManager } from \'../../../../cli/output\'');
    });

    it('should use OutputManager for output', () => {
      const queryFile = join(generatedDir, 'staff', 'queryStaff.ts');
      const content = readFileSync(queryFile, 'utf-8');
      expect(content).toContain('outputManager.output');
    });

    it('should handle errors with handleErrorAndExit', () => {
      const queryFile = join(generatedDir, 'staff', 'queryStaff.ts');
      const content = readFileSync(queryFile, 'utf-8');
      expect(content).toContain('handleErrorAndExit');
    });
  });

  describe('Command Parameters', () => {
    it('should generate options for query parameters', () => {
      const queryFile = join(generatedDir, 'staff', 'queryStaff.ts');
      const content = readFileSync(queryFile, 'utf-8');

      // queryStaff 方法只需要 id 或 code 参数（根据 API 文档）
      expect(content).toContain('--id');
      expect(content).toContain('--code');
      // 不应该有旧的参数
      expect(content).not.toContain('--name');
      expect(content).not.toContain('--department');
      expect(content).not.toContain('--status');
      expect(content).not.toContain('--page');
      expect(content).not.toContain('--pageSize');
    });

    it('should generate required option for enable/disable', () => {
      const enableFile = join(generatedDir, 'staff', 'enableStaff.ts');
      const content = readFileSync(enableFile, 'utf-8');

      // enableStaff 方法需要一个必需的 id 参数
      expect(content).toContain('--id <id>');
    });
  });
});