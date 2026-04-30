/**
 * FileStorage 单元测试
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { FileStorage } from '../../../src/infrastructure/storage/file-storage';
import { StorageError, StorageErrorType } from '../../../src/types/infrastructure';

describe('FileStorage', () => {
  let storage: FileStorage;
  let testDir: string;

  beforeEach(() => {
    storage = new FileStorage();
    // 创建临时测试目录
    testDir = path.join(os.tmpdir(), 'ybc-test', Date.now().toString());
    fs.mkdirSync(testDir, { recursive: true });
  });

  afterEach(async () => {
    // 清理测试目录
    try {
      await fs.promises.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // 忽略清理错误
    }
  });

  describe('write and read', () => {
    it('应该成功写入和读取 JSON 文件', async () => {
      const filePath = path.join(testDir, 'test.json');
      const data = { name: 'test', value: 123 };

      // 写入
      await storage.write(filePath, data);

      // 读取
      const result = await storage.read(filePath);

      expect(result).toEqual(data);
    });

    it('应该创建不存在的父目录', async () => {
      const filePath = path.join(testDir, 'subdir', 'deep', 'test.json');
      const data = { test: true };

      await storage.write(filePath, data);

      const result = await storage.read(filePath);
      expect(result).toEqual(data);
    });

    it('应该设置正确的文件权限（600）', async () => {
      const filePath = path.join(testDir, 'test-permissions.json');
      const data = { test: true };

      await storage.write(filePath, data, { mode: 0o600 });

      // Windows 使用不同的权限模型，仅验证文件可读写
      const stats = await fs.promises.stat(filePath);
      const mode = stats.mode & 0o777;

      // 在 Windows 上，权限可能是不同的值（通常为 0o666），所以只验证可读写
      if (process.platform === 'win32') {
        expect(mode & 0o600).toBe(0o600); // 验证至少有读写权限
      } else {
        expect(mode).toBe(0o600);
      }
    });

    it('应该格式化 JSON（pretty 模式）', async () => {
      const filePath = path.join(testDir, 'test-pretty.json');
      const data = { name: 'test', nested: { key: 'value' } };

      await storage.write(filePath, data, { pretty: true });

      const content = await fs.promises.readFile(filePath, 'utf-8');
      expect(content).toContain('\n'); // 应该有换行
      expect(content).toContain('  '); // 应该有缩进
    });

    it('应该压缩 JSON（非 pretty 模式）', async () => {
      const filePath = path.join(testDir, 'test-compact.json');
      const data = { name: 'test' };

      await storage.write(filePath, data, { pretty: false });

      const content = await fs.promises.readFile(filePath, 'utf-8');
      expect(content).toBe('{"name":"test"}');
    });

    it('应该原子性写入（使用临时文件）', async () => {
      const filePath = path.join(testDir, 'test-atomic.json');
      const data = { test: true };

      await storage.write(filePath, data);

      // 临时文件应该被清理
      const tempFile = `${filePath}.tmp`;
      const tempExists = await storage.exists(tempFile);
      expect(tempExists).toBe(false);

      // 原始文件应该存在
      const result = await storage.read(filePath);
      expect(result).toEqual(data);
    });
  });

  describe('read errors', () => {
    it('应该抛出 FILE_NOT_FOUND 错误当文件不存在', async () => {
      const filePath = path.join(testDir, 'not-exist.json');

      await expect(storage.read(filePath)).rejects.toThrow(StorageError);

      try {
        await storage.read(filePath);
      } catch (error) {
        expect(error).toBeInstanceOf(StorageError);
        expect((error as StorageError).type).toBe(StorageErrorType.FILE_NOT_FOUND);
        expect((error as StorageError).filePath).toBe(filePath);
      }
    });

    it('应该抛出 JSON_PARSE_ERROR 错误当文件不是有效 JSON', async () => {
      const filePath = path.join(testDir, 'invalid.json');

      // 写入无效 JSON
      await fs.promises.writeFile(filePath, 'not a json', 'utf-8');

      await expect(storage.read(filePath)).rejects.toThrow(StorageError);

      try {
        await storage.read(filePath);
      } catch (error) {
        expect(error).toBeInstanceOf(StorageError);
        expect((error as StorageError).type).toBe(StorageErrorType.JSON_PARSE_ERROR);
      }
    });
  });

  describe('exists', () => {
    it('应该返回 true 当文件存在', async () => {
      const filePath = path.join(testDir, 'exists.json');
      await fs.promises.writeFile(filePath, '{}', 'utf-8');

      const exists = await storage.exists(filePath);
      expect(exists).toBe(true);
    });

    it('应该返回 false 当文件不存在', async () => {
      const filePath = path.join(testDir, 'not-exists.json');

      const exists = await storage.exists(filePath);
      expect(exists).toBe(false);
    });
  });

  describe('delete', () => {
    it('应该成功删除文件', async () => {
      const filePath = path.join(testDir, 'to-delete.json');
      await storage.write(filePath, { test: true });

      await storage.delete(filePath);

      const exists = await storage.exists(filePath);
      expect(exists).toBe(false);
    });

    it('应该抛出 FILE_NOT_FOUND 错误当删除不存在的文件', async () => {
      const filePath = path.join(testDir, 'not-exist.json');

      await expect(storage.delete(filePath)).rejects.toThrow(StorageError);

      try {
        await storage.delete(filePath);
      } catch (error) {
        expect(error).toBeInstanceOf(StorageError);
        expect((error as StorageError).type).toBe(StorageErrorType.FILE_NOT_FOUND);
      }
    });
  });

  describe('stat', () => {
    it('应该成功获取文件状态', async () => {
      const filePath = path.join(testDir, 'test-stat.json');
      const data = { test: true };
      await storage.write(filePath, data);

      const stats = await storage.stat(filePath);

      expect(stats.isFile()).toBe(true);
      expect(stats.size).toBeGreaterThan(0);
    });

    it('应该抛出错误当文件不存在', async () => {
      const filePath = path.join(testDir, 'not-exist.json');

      await expect(storage.stat(filePath)).rejects.toThrow(StorageError);
    });
  });

  describe('copy', () => {
    it('应该成功复制文件', async () => {
      const srcPath = path.join(testDir, 'source.json');
      const destPath = path.join(testDir, 'dest.json');
      const data = { test: 'copy' };

      await storage.write(srcPath, data);
      await storage.copy(srcPath, destPath);

      const result = await storage.read(destPath);
      expect(result).toEqual(data);
    });

    it('应该创建目标目录', async () => {
      const srcPath = path.join(testDir, 'source.json');
      const destPath = path.join(testDir, 'subdir', 'dest.json');
      const data = { test: 'copy' };

      await storage.write(srcPath, data);
      await storage.copy(srcPath, destPath);

      const result = await storage.read(destPath);
      expect(result).toEqual(data);
    });

    it('应该抛出错误当源文件不存在', async () => {
      const srcPath = path.join(testDir, 'not-exist.json');
      const destPath = path.join(testDir, 'dest.json');

      await expect(storage.copy(srcPath, destPath)).rejects.toThrow(StorageError);
    });

    it('应该设置正确的权限', async () => {
      const srcPath = path.join(testDir, 'source.json');
      const destPath = path.join(testDir, 'dest.json');
      const data = { test: true };

      await storage.write(srcPath, data);
      await storage.copy(srcPath, destPath, { mode: 0o600 });

      const stats = await fs.promises.stat(destPath);
      const mode = stats.mode & 0o777;

      // 在 Windows 上验证可读写权限
      if (process.platform === 'win32') {
        expect(mode & 0o600).toBe(0o600);
      } else {
        expect(mode).toBe(0o600);
      }
    });
  });

  describe('edge cases', () => {
    it('应该处理空对象', async () => {
      const filePath = path.join(testDir, 'empty.json');
      const data = {};

      await storage.write(filePath, data);
      const result = await storage.read(filePath);

      expect(result).toEqual({});
    });

    it('应该处理数组', async () => {
      const filePath = path.join(testDir, 'array.json');
      const data = [1, 2, 3, { key: 'value' }];

      await storage.write(filePath, data);
      const result = await storage.read(filePath);

      expect(result).toEqual(data);
    });

    it('应该处理嵌套对象', async () => {
      const filePath = path.join(testDir, 'nested.json');
      const data = {
        level1: {
          level2: {
            level3: {
              value: 'deep',
            },
          },
        },
      };

      await storage.write(filePath, data);
      const result = await storage.read(filePath);

      expect(result).toEqual(data);
    });

    it('应该处理特殊字符', async () => {
      const filePath = path.join(testDir, 'special.json');
      const data = {
        unicode: '你好世界 🌍',
        emoji: '😀 🎉',
        special: 'newline\n\ttab',
      };

      await storage.write(filePath, data);
      const result = await storage.read(filePath);

      expect(result).toEqual(data);
    });
  });
});
