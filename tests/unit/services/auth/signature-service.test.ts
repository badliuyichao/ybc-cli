/**
 * SignatureService 单元测试
 *
 * 测试签名计算的正确性、时间戳生成和签名验证
 */

import * as crypto from 'crypto';
import { SignatureService } from '@/services/auth/signature-service';

describe('SignatureService', () => {
  let service: SignatureService;

  beforeEach(() => {
    service = new SignatureService();
  });

  describe('calculateSignature', () => {
    it('should calculate signature correctly with official example', () => {
      // 使用官方文档示例数据验证
      const params = {
        appKey: '41832a3d2df94989b500da6a22268747',
        timestamp: 1568098531823,
        appSecret: 'test-secret',
      };

      const signature = service.calculateSignature(params);

      // 验证格式：签名必须是字符串
      expect(signature).toBeDefined();
      expect(typeof signature).toBe('string');

      // 验证 Base64 格式
      expect(signature.length).toBeGreaterThan(0);

      // 验证是有效的 Base64
      expect(signature).toMatch(/^[A-Za-z0-9+/=]+$/); // Base64 格式
    });

    it('should generate correct拼接字符串 (concatenation)', () => {
      const params = {
        appKey: 'test-app-key',
        timestamp: 1234567890123,
        appSecret: 'test-secret',
      };

      // 手动计算拼接字符串
      const expectedString = 'appKeytest-app-keytimestamp1234567890123';

      // 使用 HmacSHA256 计算
      const hmac = crypto.createHmac('sha256', params.appSecret);
      hmac.update(expectedString, 'utf8');
      const expectedSignature = hmac.digest().toString('base64');

      const actualSignature = service.calculateSignature(params);

      expect(actualSignature).toBe(expectedSignature);
    });

    it('should use HmacSHA256 algorithm', () => {
      const params = {
        appKey: 'key123',
        timestamp: 9999999999999,
        appSecret: 'secret123',
      };

      const signature = service.calculateSignature(params);

      // 验证签名结构
      const decodedBase64 = decodeURIComponent(signature);

      // Base64 解码后应该是 32 字节（SHA256 输出）
      const binary = Buffer.from(decodedBase64, 'base64');
      expect(binary.length).toBe(32); // SHA256 输出 32 字节
    });

    it('should apply Base64 encoding correctly', () => {
      const params = {
        appKey: 'appkey-test',
        timestamp: 1111111111111,
        appSecret: 'secret-test',
      };

      const signature = service.calculateSignature(params);

      // 验证 Base64 格式
      const decoded = signature;

      // Base64 格式检查：只能包含 A-Z, a-z, 0-9, +, /, =
      expect(decoded).toMatch(/^[A-Za-z0-9+/=]+$/);
    });

    it('should produce Base64 without URL encoding', () => {
      const params = {
        appKey: 'appkey',
        timestamp: 2222222222222,
        appSecret: 'secret',
      };

      const signature = service.calculateSignature(params);

      // 验证签名是原始 Base64，不含 % 编码字符
      // 特殊字符 + 和 / 在 Base64 中是正常的，不应该被编码
      expect(signature).toMatch(/^[A-Za-z0-9+/=]+$/);
      // 不应该包含 URL 编码的特殊字符
      expect(signature).not.toMatch(/%[0-9A-F]{2}/);
    });

    it('should produce consistent signature for same inputs', () => {
      const params = {
        appKey: 'consistent-key',
        timestamp: 3333333333333,
        appSecret: 'consistent-secret',
      };

      const signature1 = service.calculateSignature(params);
      const signature2 = service.calculateSignature(params);

      expect(signature1).toBe(signature2);
    });

    it('should produce different signature for different appKey', () => {
      const params1 = {
        appKey: 'key1',
        timestamp: 4444444444444,
        appSecret: 'same-secret',
      };

      const params2 = {
        appKey: 'key2',
        timestamp: 4444444444444,
        appSecret: 'same-secret',
      };

      const signature1 = service.calculateSignature(params1);
      const signature2 = service.calculateSignature(params2);

      expect(signature1).not.toBe(signature2);
    });

    it('should produce different signature for different timestamp', () => {
      const params1 = {
        appKey: 'same-key',
        timestamp: 5555555555555,
        appSecret: 'same-secret',
      };

      const params2 = {
        appKey: 'same-key',
        timestamp: 6666666666666,
        appSecret: 'same-secret',
      };

      const signature1 = service.calculateSignature(params1);
      const signature2 = service.calculateSignature(params2);

      expect(signature1).not.toBe(signature2);
    });

    it('should produce different signature for different appSecret', () => {
      const params1 = {
        appKey: 'same-key',
        timestamp: 7777777777777,
        appSecret: 'secret1',
      };

      const params2 = {
        appKey: 'same-key',
        timestamp: 7777777777777,
        appSecret: 'secret2',
      };

      const signature1 = service.calculateSignature(params1);
      const signature2 = service.calculateSignature(params2);

      expect(signature1).not.toBe(signature2);
    });

    it('should handle special characters in appKey', () => {
      const params = {
        appKey: 'app-key-with-special!@#$%',
        timestamp: 8888888888888,
        appSecret: 'secret',
      };

      const signature = service.calculateSignature(params);

      expect(signature).toBeDefined();
      expect(typeof signature).toBe('string');
      expect(signature.length).toBeGreaterThan(0);
    });

    it('should handle long appKey and appSecret', () => {
      const params = {
        appKey: 'a'.repeat(128),
        timestamp: 9999999999999,
        appSecret: 's'.repeat(256),
      };

      const signature = service.calculateSignature(params);

      expect(signature).toBeDefined();
      expect(typeof signature).toBe('string');
    });
  });

  describe('generateTimestamp', () => {
    it('should generate millisecond-level timestamp (13 digits)', () => {
      const timestamp = service.generateTimestamp();

      // 验证是毫秒级时间戳（13位数字）
      expect(timestamp).toBeGreaterThan(1000000000000); // 2001-09-09 之后
      expect(timestamp).toBeLessThan(9999999999999); // 2286-11-20 之前

      // 验证是数字类型
      expect(typeof timestamp).toBe('number');
    });

    it('should generate current time', () => {
      const before = Date.now();
      const timestamp = service.generateTimestamp();
      const after = Date.now();

      // 验证时间戳在合理范围内（前后 100ms）
      expect(timestamp).toBeGreaterThanOrEqual(before);
      expect(timestamp).toBeLessThanOrEqual(after);
    });

    it('should generate unique timestamps (at least different when called with delay)', () => {
      const timestamp1 = service.generateTimestamp();

      // 等待至少 1ms
      const start = Date.now();
      while (Date.now() - start < 2) {
        // 等待
      }

      const timestamp2 = service.generateTimestamp();

      // 验证时间戳不同（至少相差 1ms）
      expect(timestamp2).toBeGreaterThanOrEqual(timestamp1 + 1);
    });
  });

  describe('verifySignature', () => {
    it('should return true for correct signature', () => {
      const params = {
        appKey: 'test-key',
        timestamp: 1234567890123,
        appSecret: 'test-secret',
      };

      const signature = service.calculateSignature(params);
      const isValid = service.verifySignature(params, signature);

      expect(isValid).toBe(true);
    });

    it('should return false for incorrect signature', () => {
      const params = {
        appKey: 'test-key',
        timestamp: 1234567890123,
        appSecret: 'test-secret',
      };

      const correctSignature = service.calculateSignature(params);
      const wrongSignature = 'wrong-signature-value';

      const isValid = service.verifySignature(params, wrongSignature);

      expect(isValid).toBe(false);
    });

    it('should return false for slightly modified signature', () => {
      const params = {
        appKey: 'test-key',
        timestamp: 1234567890123,
        appSecret: 'test-secret',
      };

      const signature = service.calculateSignature(params);
      const modifiedSignature = signature + 'x'; // 添加一个字符

      const isValid = service.verifySignature(params, modifiedSignature);

      expect(isValid).toBe(false);
    });

    it('should return false for signature with different encoding', () => {
      const params = {
        appKey: 'test-key',
        timestamp: 1234567890123,
        appSecret: 'test-secret',
      };

      const signature = service.calculateSignature(params);
      // 修改后的签名（无效的签名）
      const modifiedSignature = signature.substring(0, signature.length - 5) + 'XXXXX';

      const isValid = service.verifySignature(params, modifiedSignature);

      expect(isValid).toBe(false);
    });

    it('should verify signature for various appKeys', () => {
      const testCases = [
        { appKey: 'key1', timestamp: 1111111111111, appSecret: 'secret1' },
        { appKey: 'key2', timestamp: 2222222222222, appSecret: 'secret2' },
        { appKey: 'key3', timestamp: 3333333333333, appSecret: 'secret3' },
      ];

      for (const params of testCases) {
        const signature = service.calculateSignature(params);
        const isValid = service.verifySignature(params, signature);
        expect(isValid).toBe(true);
      }
    });
  });

  describe('signature algorithm integration', () => {
    it('should follow complete 5-step process', () => {
      const params = {
        appKey: 'test-app-key',
        timestamp: 1234567890123,
        appSecret: 'test-app-secret',
      };

      // 手动执行完整的签名流程
      // 步骤 1: 构建参数对象
      const paramMap: Record<string, string> = {
        appKey: params.appKey,
        timestamp: params.timestamp.toString(),
      };

      // 步骤 2: 按字母序排序
      const sortedKeys = Object.keys(paramMap).sort();

      // 步骤 3: 拼接
      let signString = '';
      for (const key of sortedKeys) {
        signString += key + paramMap[key];
      }

      // 步骤 4: HmacSHA256
      const hmac = crypto.createHmac('sha256', params.appSecret);
      hmac.update(signString, 'utf8');
      const signatureBinary = hmac.digest();

      // 步骤 5: Base64（不再进行 URLEncode，让 axios 处理编码）
      const signatureBase64 = signatureBinary.toString('base64');
      const expectedSignature = signatureBase64;

      // 与服务生成的签名对比
      const actualSignature = service.calculateSignature(params);

      expect(actualSignature).toBe(expectedSignature);
    });
  });
});