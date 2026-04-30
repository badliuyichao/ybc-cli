/**
 * 文件存储服务
 *
 * 提供安全的文件读写操作，支持权限控制和错误处理
 */

/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/explicit-module-boundary-types */

import * as fs from 'fs';
import * as path from 'path';
import { StorageOptions, StorageError, StorageErrorType } from '../../types/infrastructure';

/**
 * 文件存储服务类
 *
 * 功能：
 * - 文件读写操作
 * - 自动创建父目录
 * - 文件权限控制（默认 0o600）
 * - JSON 序列化/反序列化
 * - 错误处理
 */
export class FileStorage {
  private readonly defaultOptions: StorageOptions = {
    mode: 0o600, // 仅所有者可读写
    createDir: true,
    pretty: true,
  };

  /**
   * 读取文件内容
   * @param filePath 文件路径
   * @returns 文件内容（已解析 JSON）
   * @throws StorageError 文件不存在或解析失败
   */
  async read(filePath: string): Promise<any> {
    try {
      // 检查文件是否存在
      if (!(await this.exists(filePath))) {
        throw new StorageError(
          StorageErrorType.FILE_NOT_FOUND,
          `File not found: ${filePath}`,
          filePath
        );
      }

      // 读取文件内容
      const content = await fs.promises.readFile(filePath, 'utf-8');

      // 尝试解析 JSON
      try {
        return JSON.parse(content);
      } catch (parseError) {
        throw new StorageError(
          StorageErrorType.JSON_PARSE_ERROR,
          `Failed to parse JSON in file: ${filePath}`,
          filePath,
          parseError as Error
        );
      }
    } catch (error) {
      // 如果已经是 StorageError，直接抛出
      if (error instanceof StorageError) {
        throw error;
      }

      // 处理其他错误
      throw new StorageError(
        StorageErrorType.IO_ERROR,
        `Failed to read file: ${filePath}`,
        filePath,
        error as Error
      );
    }
  }

  /**
   * 写入文件内容
   * @param filePath 文件路径
   * @param data 数据（将序列化为 JSON）
   * @param options 存储选项
   * @throws StorageError 写入失败或权限错误
   */
  async write(filePath: string, data: any, options?: StorageOptions): Promise<void> {
    const opts = { ...this.defaultOptions, ...options };

    try {
      // 创建父目录（如果需要）
      if (opts.createDir) {
        const dir = path.dirname(filePath);
        await this.ensureDirectory(dir);
      }

      // 序列化数据
      const content = opts.pretty ? JSON.stringify(data, null, 2) : JSON.stringify(data);

      // 写入文件（临时文件 + 原子操作）
      const tempPath = `${filePath}.tmp`;
      await fs.promises.writeFile(tempPath, content, {
        encoding: 'utf-8',
        mode: opts.mode,
      });

      // 原子性重命名
      await fs.promises.rename(tempPath, filePath);
    } catch (error) {
      // 清理临时文件
      const tempPath = `${filePath}.tmp`;
      try {
        await fs.promises.unlink(tempPath);
      } catch {
        // 忽略清理错误
      }

      // 抛出错误
      if ((error as any).code === 'EACCES') {
        throw new StorageError(
          StorageErrorType.PERMISSION_DENIED,
          `Permission denied: ${filePath}`,
          filePath,
          error as Error
        );
      }

      if ((error as any).code === 'EEXIST') {
        throw new StorageError(
          StorageErrorType.FILE_EXISTS,
          `File already exists: ${filePath}`,
          filePath,
          error as Error
        );
      }

      throw new StorageError(
        StorageErrorType.IO_ERROR,
        `Failed to write file: ${filePath}`,
        filePath,
        error as Error
      );
    }
  }

  /**
   * 检查文件是否存在
   * @param filePath 文件路径
   * @returns 文件是否存在
   */
  async exists(filePath: string): Promise<boolean> {
    try {
      await fs.promises.access(filePath, fs.constants.F_OK);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 删除文件
   * @param filePath 文件路径
   * @throws StorageError 文件不存在或删除失败
   */
  async delete(filePath: string): Promise<void> {
    try {
      if (!(await this.exists(filePath))) {
        throw new StorageError(
          StorageErrorType.FILE_NOT_FOUND,
          `File not found: ${filePath}`,
          filePath
        );
      }

      await fs.promises.unlink(filePath);
    } catch (error) {
      // 如果已经是 StorageError，直接抛出
      if (error instanceof StorageError) {
        throw error;
      }

      throw new StorageError(
        StorageErrorType.IO_ERROR,
        `Failed to delete file: ${filePath}`,
        filePath,
        error as Error
      );
    }
  }

  /**
   * 确保目录存在
   * @param dir 目录路径
   * @throws StorageError 目录创建失败
   */
  private async ensureDirectory(dir: string): Promise<void> {
    try {
      const exists = await this.exists(dir);
      if (!exists) {
        await fs.promises.mkdir(dir, { recursive: true, mode: 0o700 });
      }
    } catch (error) {
      throw new StorageError(
        StorageErrorType.DIRECTORY_CREATE_FAILED,
        `Failed to create directory: ${dir}`,
        dir,
        error as Error
      );
    }
  }

  /**
   * 获取文件状态信息
   * @param filePath 文件路径
   * @returns 文件状态
   */
  async stat(filePath: string): Promise<fs.Stats> {
    try {
      return await fs.promises.stat(filePath);
    } catch (error) {
      throw new StorageError(
        StorageErrorType.IO_ERROR,
        `Failed to get file stats: ${filePath}`,
        filePath,
        error as Error
      );
    }
  }

  /**
   * 复制文件
   * @param src 源文件路径
   * @param dest 目标文件路径
   * @param options 存储选项
   */
  async copy(src: string, dest: string, options?: StorageOptions): Promise<void> {
    const opts = { ...this.defaultOptions, ...options };

    try {
      // 检查源文件是否存在
      if (!(await this.exists(src))) {
        throw new StorageError(
          StorageErrorType.FILE_NOT_FOUND,
          `Source file not found: ${src}`,
          src
        );
      }

      // 创建目标目录
      if (opts.createDir) {
        const dir = path.dirname(dest);
        await this.ensureDirectory(dir);
      }

      // 复制文件
      await fs.promises.copyFile(src, dest);

      // 设置权限
      if (opts.mode) {
        await fs.promises.chmod(dest, opts.mode);
      }
    } catch (error) {
      if (error instanceof StorageError) {
        throw error;
      }

      throw new StorageError(
        StorageErrorType.IO_ERROR,
        `Failed to copy file from ${src} to ${dest}`,
        dest,
        error as Error
      );
    }
  }
}
