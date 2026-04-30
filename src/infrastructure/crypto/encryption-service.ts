/**
 * 加密服务
 *
 * 提供 AES-256-GCM 加密解密功能，支持密钥派生和管理
 */

/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument, @typescript-eslint/require-await */

import * as crypto from 'crypto';
import * as os from 'os';
import * as path from 'path';
import { FileStorage } from '../storage/file-storage';
import {
  EncryptionOptions,
  EncryptionError,
  EncryptionErrorType,
} from '../../types/infrastructure';

/**
 * 加密服务类
 *
 * 功能：
 * - AES-256-GCM 加密/解密
 * - 基于机器特征的密钥派生
 * - 密钥存储和加载
 * - 安全的随机数生成
 */
export class EncryptionService {
  private readonly defaultOptions: EncryptionOptions = {
    algorithm: 'aes-256-gcm',
    ivLength: 12,
    saltLength: 16,
    tagLength: 16,
  };

  private readonly storage: FileStorage;
  private readonly keyFilePath: string;
  private cachedKey: Buffer | null = null;

  /**
   * 构造函数
   * @param storage 文件存储服务
   * @param keyFilePath 密钥文件路径（默认 ~/.ybc/.key）
   */
  constructor(storage?: FileStorage, keyFilePath?: string) {
    this.storage = storage || new FileStorage();
    this.keyFilePath = keyFilePath || path.join(os.homedir(), '.ybc', '.key');
  }

  /**
   * 加密数据
   * @param data 明文数据
   * @param options 加密选项
   * @returns 加密后的数据（Base64 编码）
   */
  async encrypt(data: string, options?: EncryptionOptions): Promise<string> {
    const opts = { ...this.defaultOptions, ...options };

    try {
      // 获取加密密钥
      const key = await this.getOrCreateKey();

      // 生成随机 IV
      const iv = crypto.randomBytes(opts.ivLength!);

      // 创建加密器
      const cipher = crypto.createCipheriv(opts.algorithm!, key, iv) as any;

      // 加密数据
      let encrypted = cipher.update(data, 'utf8', 'hex');
      encrypted += cipher.final('hex');

      // 获取认证标签
      const authTag = cipher.getAuthTag();

      // 组合: iv + authTag + encrypted
      const combined = Buffer.concat([iv, authTag, Buffer.from(encrypted, 'hex')]);

      // 返回 Base64 编码
      return combined.toString('base64');
    } catch (error) {
      throw new EncryptionError(
        EncryptionErrorType.ENCRYPTION_FAILED,
        'Failed to encrypt data',
        error as Error
      );
    }
  }

  /**
   * 解密数据
   * @param encryptedData 加密数据（Base64 编码）
   * @param options 加密选项
   * @returns 解密后的明文
   */
  async decrypt(encryptedData: string, options?: EncryptionOptions): Promise<string> {
    const opts = { ...this.defaultOptions, ...options };

    try {
      // 获取加密密钥
      const key = await this.getOrCreateKey();

      // 解码 Base64
      const combined = Buffer.from(encryptedData, 'base64');

      // 解析: iv + authTag + encrypted（使用非空断言，因为已在 defaultOptions 中设置）
      const ivLength = opts.ivLength!;
      const tagLength = opts.tagLength!;

      const iv = combined.slice(0, ivLength);
      const authTag = combined.slice(ivLength, ivLength + tagLength);
      const encrypted = combined.slice(ivLength + tagLength);

      // 创建解密器
      const decipher = crypto.createDecipheriv(opts.algorithm!, key, iv) as any;
      decipher.setAuthTag(authTag);

      // 解密数据
      let decrypted = decipher.update(encrypted, null, 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      throw new EncryptionError(
        EncryptionErrorType.DECRYPTION_FAILED,
        'Failed to decrypt data',
        error as Error
      );
    }
  }

  /**
   * 生成加密密钥
   * @returns 密钥（Base64 编码）
   */
  async generateKey(): Promise<string> {
    try {
      // 生成随机密钥
      const key = crypto.randomBytes(32); // 256 bits
      const keyBase64 = key.toString('base64');

      return keyBase64;
    } catch (error) {
      throw new EncryptionError(
        EncryptionErrorType.KEY_GENERATION_FAILED,
        'Failed to generate encryption key',
        error as Error
      );
    }
  }

  /**
   * 存储密钥到文件
   * @param key 密钥（Base64 编码）
   */
  async storeKey(key: string): Promise<void> {
    try {
      // 将密钥存储到文件
      await this.storage.write(this.keyFilePath, {
        key,
        version: 'v1',
        createdAt: new Date().toISOString(),
      });
    } catch (error) {
      throw new EncryptionError(
        EncryptionErrorType.KEY_STORAGE_FAILED,
        'Failed to store encryption key',
        error as Error
      );
    }
  }

  /**
   * 从文件加载密钥
   * @returns 密钥（Base64 编码）
   */
  async loadKey(): Promise<string> {
    try {
      const data = await this.storage.read(this.keyFilePath);
      return data.key;
    } catch (error) {
      throw new EncryptionError(
        EncryptionErrorType.KEY_LOAD_FAILED,
        'Failed to load encryption key',
        error as Error
      );
    }
  }

  /**
   * 获取或创建密钥
   * @returns 密钥 Buffer
   */
  private async getOrCreateKey(): Promise<Buffer> {
    // 如果已缓存，直接返回
    if (this.cachedKey) {
      return this.cachedKey;
    }

    try {
      // 尝试加载现有密钥
      const keyBase64 = await this.loadKey();
      this.cachedKey = Buffer.from(keyBase64, 'base64');
      return this.cachedKey;
    } catch (error) {
      // 如果密钥不存在，创建新密钥
      if (error instanceof EncryptionError && error.type === EncryptionErrorType.KEY_LOAD_FAILED) {
        // 从机器特征派生密钥
        const machineId = this.getMachineId();
        const derivedKey = this.deriveKeyFromMachineId(machineId);

        // 缓存密钥
        this.cachedKey = derivedKey;
        return derivedKey;
      }

      throw error;
    }
  }

  /**
   * 从机器特征派生密钥
   * @param machineId 机器 ID
   * @returns 派生密钥
   */
  private deriveKeyFromMachineId(machineId: string): Buffer {
    const salt = crypto.createHash('sha256').update(machineId).digest().slice(0, 16);
    const key = crypto.pbkdf2Sync(machineId, salt, 100000, 32, 'sha256');
    return key;
  }

  /**
   * 获取机器 ID
   * @returns 机器 ID（主机名-用户名-平台）
   */
  private getMachineId(): string {
    const hostname = os.hostname();
    const username = os.userInfo().username;
    const platform = os.platform();
    return `${hostname}-${username}-${platform}`;
  }

  /**
   * 清除缓存的密钥
   */
  clearCache(): void {
    this.cachedKey = null;
  }

  /**
   * 验证加密数据格式
   * @param encryptedData 加密数据
   * @returns 是否有效
   */
  validateEncryptedData(encryptedData: string): boolean {
    try {
      const combined = Buffer.from(encryptedData, 'base64');
      const opts = this.defaultOptions;

      // 检查最小长度
      const minLength = opts.ivLength! + opts.tagLength!;
      if (combined.length < minLength) {
        return false;
      }

      return true;
    } catch {
      return false;
    }
  }
}
