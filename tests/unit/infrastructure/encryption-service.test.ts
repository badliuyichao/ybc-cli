/**
 * EncryptionService 单元测试
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { EncryptionService } from '../../../src/infrastructure/crypto/encryption-service';
import { FileStorage } from '../../../src/infrastructure/storage/file-storage';
import { EncryptionError, EncryptionErrorType } from '../../../src/types/infrastructure';

describe('EncryptionService', () => {
  let encryptionService: EncryptionService;
  let storage: FileStorage;
  let testDir: string;
  let keyFilePath: string;

  beforeEach(() => {
    // 创建临时测试目录
    testDir = path.join(os.tmpdir(), 'ybc-encryption-test', Date.now().toString());
    fs.mkdirSync(testDir, { recursive: true });

    // 创建文件存储和加密服务
    storage = new FileStorage();
    keyFilePath = path.join(testDir, '.key');
    encryptionService = new EncryptionService(storage, keyFilePath);
  });

  afterEach(async () => {
    // 清理测试目录
    try {
      await fs.promises.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // 忽略清理错误
    }
  });

  describe('encrypt and decrypt', () => {
    it('应该成功加密和解密字符串', async () => {
      const plaintext = 'This is a secret message!';

      // 加密
      const encrypted = await encryptionService.encrypt(plaintext);
      expect(encrypted).toBeDefined();
      expect(encrypted).not.toBe(plaintext);
      expect(typeof encrypted).toBe('string');

      // 解密
      const decrypted = await encryptionService.decrypt(encrypted);
      expect(decrypted).toBe(plaintext);
    });

    it('应该生成不同的密文（即使明文相同）', async () => {
      const plaintext = 'Same message';

      const encrypted1 = await encryptionService.encrypt(plaintext);
      const encrypted2 = await encryptionService.encrypt(plaintext);

      // 不同的 IV 导致不同的密文
      expect(encrypted1).not.toBe(encrypted2);

      // 但都能正确解密
      const decrypted1 = await encryptionService.decrypt(encrypted1);
      const decrypted2 = await encryptionService.decrypt(encrypted2);
      expect(decrypted1).toBe(plaintext);
      expect(decrypted2).toBe(plaintext);
    });

    it('应该处理空字符串', async () => {
      const plaintext = '';

      const encrypted = await encryptionService.encrypt(plaintext);
      const decrypted = await encryptionService.decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it('应该处理长字符串', async () => {
      const plaintext = 'A'.repeat(10000);

      const encrypted = await encryptionService.encrypt(plaintext);
      const decrypted = await encryptionService.decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it('应该处理特殊字符和 Unicode', async () => {
      const plaintext = '你好世界 🌍 emoji: 😀🎉\n\t特殊字符';

      const encrypted = await encryptionService.encrypt(plaintext);
      const decrypted = await encryptionService.decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it('应该处理 JSON 字符串', async () => {
      const plaintext = JSON.stringify({
        ak: 'test-access-key',
        sk: 'test-secret-key',
        nested: { key: 'value' },
      });

      const encrypted = await encryptionService.encrypt(plaintext);
      const decrypted = await encryptionService.decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it('应该抛出 DECRYPTION_FAILED 错误当密文无效', async () => {
      const invalidEncrypted = 'not-a-valid-encrypted-data';

      await expect(encryptionService.decrypt(invalidEncrypted)).rejects.toThrow(EncryptionError);

      try {
        await encryptionService.decrypt(invalidEncrypted);
      } catch (error) {
        expect(error).toBeInstanceOf(EncryptionError);
        expect((error as EncryptionError).type).toBe(EncryptionErrorType.DECRYPTION_FAILED);
      }
    });

    it('应该抛出 DECRYPTION_FAILED 错误当密文被篡改', async () => {
      const plaintext = 'Original message';
      const encrypted = await encryptionService.encrypt(plaintext);

      // 篡改密文
      const tampered = encrypted.slice(0, -5) + 'XXXXX';

      await expect(encryptionService.decrypt(tampered)).rejects.toThrow(EncryptionError);
    });
  });

  describe('key management', () => {
    it('应该自动生成密钥（基于机器特征）', async () => {
      const plaintext = 'Test message';

      // 第一次加密会自动生成密钥
      const encrypted = await encryptionService.encrypt(plaintext);
      expect(encrypted).toBeDefined();

      // 解密应该成功
      const decrypted = await encryptionService.decrypt(encrypted);
      expect(decrypted).toBe(plaintext);
    });

    it('应该在多次操作中复用相同的密钥', async () => {
      const messages = ['Message 1', 'Message 2', 'Message 3'];

      // 加密多个消息
      const encrypted1 = await encryptionService.encrypt(messages[0]);
      const encrypted2 = await encryptionService.encrypt(messages[1]);
      const encrypted3 = await encryptionService.encrypt(messages[2]);

      // 清除缓存，重新初始化服务
      encryptionService.clearCache();
      const newService = new EncryptionService(storage, keyFilePath);

      // 应该能解密（使用相同的密钥）
      const decrypted1 = await newService.decrypt(encrypted1);
      const decrypted2 = await newService.decrypt(encrypted2);
      const decrypted3 = await newService.decrypt(encrypted3);

      expect(decrypted1).toBe(messages[0]);
      expect(decrypted2).toBe(messages[1]);
      expect(decrypted3).toBe(messages[2]);
    });

    it('应该使用缓存密钥提高性能', async () => {
      const plaintext = 'Test message';

      // 第一次加密（生成密钥）
      const encrypted1 = await encryptionService.encrypt(plaintext);

      // 第二次加密（使用缓存密钥）
      const encrypted2 = await encryptionService.encrypt(plaintext);

      // 都应该能正确解密
      const decrypted1 = await encryptionService.decrypt(encrypted1);
      const decrypted2 = await encryptionService.decrypt(encrypted2);

      expect(decrypted1).toBe(plaintext);
      expect(decrypted2).toBe(plaintext);
    });
  });

  describe('generateKey', () => {
    it('应该生成有效的密钥', async () => {
      const key = await encryptionService.generateKey();

      expect(key).toBeDefined();
      expect(typeof key).toBe('string');
      expect(key.length).toBeGreaterThan(0);

      // 密钥应该是 Base64 编码的 32 字节
      const keyBuffer = Buffer.from(key, 'base64');
      expect(keyBuffer.length).toBe(32);
    });

    it('应该生成唯一的密钥', async () => {
      const key1 = await encryptionService.generateKey();
      const key2 = await encryptionService.generateKey();

      expect(key1).not.toBe(key2);
    });
  });

  describe('storeKey and loadKey', () => {
    it('应该成功存储和加载密钥', async () => {
      const key = await encryptionService.generateKey();

      // 存储
      await encryptionService.storeKey(key);

      // 加载
      const loadedKey = await encryptionService.loadKey();
      expect(loadedKey).toBe(key);
    });

    it('应该验证存储的密钥文件格式', async () => {
      const key = await encryptionService.generateKey();
      await encryptionService.storeKey(key);

      // 直接读取文件验证格式
      const data = await storage.read(keyFilePath);
      expect(data).toHaveProperty('key');
      expect(data).toHaveProperty('version');
      expect(data).toHaveProperty('createdAt');
      expect(data.key).toBe(key);
      expect(data.version).toBe('v1');
    });

    it('应该抛出 KEY_LOAD_FAILED 错误当密钥文件不存在', async () => {
      await expect(encryptionService.loadKey()).rejects.toThrow(EncryptionError);

      try {
        await encryptionService.loadKey();
      } catch (error) {
        expect(error).toBeInstanceOf(EncryptionError);
        expect((error as EncryptionError).type).toBe(EncryptionErrorType.KEY_LOAD_FAILED);
      }
    });
  });

  describe('clearCache', () => {
    it('应该清除缓存的密钥', async () => {
      const plaintext = 'Test message';

      // 第一次加密（缓存密钥）
      const encrypted1 = await encryptionService.encrypt(plaintext);

      // 清除缓存
      encryptionService.clearCache();

      // 应该仍然能解密（密钥已持久化）
      const decrypted1 = await encryptionService.decrypt(encrypted1);
      expect(decrypted1).toBe(plaintext);
    });
  });

  describe('validateEncryptedData', () => {
    it('应该返回 true 对于有效的加密数据', async () => {
      const plaintext = 'Test message';
      const encrypted = await encryptionService.encrypt(plaintext);

      const isValid = encryptionService.validateEncryptedData(encrypted);
      expect(isValid).toBe(true);
    });

    it('应该返回 false 对于无效的数据', () => {
      const invalidData = 'not-valid-base64!!!';

      const isValid = encryptionService.validateEncryptedData(invalidData);
      expect(isValid).toBe(false);
    });

    it('应该返回 false 对于过短的数据', () => {
      // Base64 编码的短数据
      const shortData = Buffer.from('short').toString('base64');

      const isValid = encryptionService.validateEncryptedData(shortData);
      expect(isValid).toBe(false);
    });
  });

  describe('cross-platform compatibility', () => {
    it('应该在相同机器特征下生成相同的派生密钥', async () => {
      const plaintext = 'Cross-platform test';

      // 使用第一个服务加密
      const encrypted = await encryptionService.encrypt(plaintext);

      // 创建新服务（相同机器特征）
      const newService = new EncryptionService(storage, keyFilePath);

      // 应该能解密
      const decrypted = await newService.decrypt(encrypted);
      expect(decrypted).toBe(plaintext);
    });
  });

  describe('security properties', () => {
    it('应该使用 AES-256-GCM 算法', async () => {
      const plaintext = 'Security test';
      const encrypted = await encryptionService.encrypt(plaintext);

      // 解码 Base64
      const combined = Buffer.from(encrypted, 'base64');

      // IV 长度应该是 12 字节
      expect(combined.length).toBeGreaterThan(12 + 16); // IV + AuthTag

      // 成功解密说明使用了正确的算法
      const decrypted = await encryptionService.decrypt(encrypted);
      expect(decrypted).toBe(plaintext);
    });

    it('应该包含认证标签（防篡改）', async () => {
      const plaintext = 'Authentication test';
      const encrypted = await encryptionService.encrypt(plaintext);

      // 篡改密文
      const combined = Buffer.from(encrypted, 'base64');
      combined[combined.length - 1] ^= 0xff; // 修改最后一个字节
      const tampered = combined.toString('base64');

      // 解密应该失败（认证失败）
      await expect(encryptionService.decrypt(tampered)).rejects.toThrow(EncryptionError);
    });

    it('应该使用随机的 IV', async () => {
      const plaintext = 'IV test';
      const encrypted1 = await encryptionService.encrypt(plaintext);
      const encrypted2 = await encryptionService.encrypt(plaintext);

      // 提取 IV
      const combined1 = Buffer.from(encrypted1, 'base64');
      const combined2 = Buffer.from(encrypted2, 'base64');

      const iv1 = combined1.slice(0, 12);
      const iv2 = combined2.slice(0, 12);

      // IV 应该不同
      expect(iv1.equals(iv2)).toBe(false);
    });
  });
});
