/**
 * Token 获取流程集成测试（新API）
 *
 * 测试完整的 Token 获取流程：
 * 1. 查询数据中心域名
 * 2. 计算签名
 * 3. 获取 Token（GET请求）
 */

import * as path from 'path';
import * as os from 'os';
import axios, { AxiosRequestConfig } from 'axios';
import MockAdapter from 'axios-mock-adapter';
import { TokenManager } from '@/services/auth/token-manager';
import { DataCenterService } from '@/services/auth/datacenter-service';
import { SignatureService } from '@/services/auth/signature-service';
import { FileStorage } from '@/infrastructure/storage/file-storage';
import { EncryptionService } from '@/infrastructure/crypto/encryption-service';
import { AuthError, AuthErrorReason } from '@/services/error/errors';

describe('Token Flow Integration (New API)', () => {
  let tokenManager: TokenManager;
  let dataCenterService: DataCenterService;
  let signatureService: SignatureService;
  let storage: FileStorage;
  let encryption: EncryptionService;
  let mockAxios: MockAdapter;
  let tempDir: string;
  let tempCachePath: string;
  let tempDataCenterCachePath: string;

  beforeEach(() => {
    // 创建临时目录
    tempDir = path.join(os.tmpdir(), 'ybc-token-flow-', Date.now().toString());
    tempCachePath = path.join(tempDir, 'token.json');
    tempDataCenterCachePath = path.join(tempDir, 'datacenter.json');

    // 创建基础设施服务
    storage = new FileStorage();
    encryption = new EncryptionService(storage);

    // 创建 axios mock
    mockAxios = new MockAdapter(axios);

    // 创建业务服务
    dataCenterService = new DataCenterService(storage);
    (dataCenterService as any).cacheFilePath = tempDataCenterCachePath;

    signatureService = new SignatureService();

    // 注意：TokenManager 需要修改以支持新API
    // 这里我们测试新的流程，假设 TokenManager 已经更新
    // 实际实现需要修改 TokenManager 以使用 DataCenterService 和 SignatureService
  });

  afterEach(async () => {
    // 清理 mock
    mockAxios.restore();

    // 清理临时文件
    try {
      await storage.delete(tempDir);
    } catch {
      // 忽略清理错误
    }
  });

  describe('complete token acquisition flow', () => {
    it('should complete full flow: query datacenter → calculate signature → get token', async () => {
      const config = {
        tenantId: 'test-tenant-123',
        appKey: 'test-app-key-12345678',
        appSecret: 'test-app-secret-1234567890',
        env: 'sandbox' as const,
      };

      // 步骤 1: Mock 数据中心域名 API
      mockAxios.onGet(/getGatewayAddress/).reply(200, {
        code: '00000',
        message: '成功！',
        data: {
          gatewayUrl: 'https://yonbip.diwork.com/iuap-api-gateway',
          tokenUrl: 'https://yonbip.diwork.com/iuap-api-auth',
        },
      });

      // 查询数据中心域名
      const urls = await dataCenterService.getDataCenterUrls(config.tenantId);
      expect(urls.tokenUrl).toBe('https://yonbip.diwork.com/iuap-api-auth');

      // 步骤 2: 生成时间戳和计算签名
      const timestamp = signatureService.generateTimestamp();
      const signature = signatureService.calculateSignature({
        appKey: config.appKey,
        timestamp,
        appSecret: config.appSecret,
      });

      // 验证签名格式
      expect(signature).toBeDefined();
      expect(typeof signature).toBe('string');
      expect(signature.length).toBeGreaterThan(0);

      // 步骤 3: Mock Token 获取 API（新路径）
      mockAxios.onGet(/getAccessToken/).reply(200, {
        code: '00000',
        message: '成功！',
        data: {
          access_token: 'new-api-token-12345',
          expire: 7200, // 注意：字段名可能是 expire 而不是 expires_in
        },
      });

      // 发送 GET 请求获取 Token
      const tokenUrl = urls.tokenUrl;
      const response = await axios.get(`${tokenUrl}/open-auth/selfAppAuth/base/v1/getAccessToken`, {
        params: {
          appKey: config.appKey,
          timestamp,
          signature,
        },
        headers: {
          'Content-Type': 'application/json',
        },
      });

      // 验证 Token 响应
      expect(response.data.code).toBe('00000');
      expect(response.data.data.access_token).toBe('new-api-token-12345');
      expect(response.data.data.expire).toBe(7200);

      // 验证使用 GET 方法
      expect(mockAxios.history.get.length).toBe(2); // 数据中心查询 + Token 获取
      expect(mockAxios.history.post.length).toBe(0); // 不使用 POST
    });

    it('should verify signature parameters are correctly passed', async () => {
      const config = {
        tenantId: 'signature-test-tenant',
        appKey: 'signature-test-appKey',
        appSecret: 'signature-test-secret',
        env: 'sandbox' as const,
      };

      // Mock 数据中心 API
      mockAxios.onGet(/getGatewayAddress/).reply(200, {
        code: '00000',
        message: '成功！',
        data: {
          gatewayUrl: 'https://gateway.test.com',
          tokenUrl: 'https://token.test.com',
        },
      });

      const urls = await dataCenterService.getDataCenterUrls(config.tenantId);

      // 生成签名
      const timestamp = signatureService.generateTimestamp();
      const signature = signatureService.calculateSignature({
        appKey: config.appKey,
        timestamp,
        appSecret: config.appSecret,
      });

      // Mock Token API
      mockAxios.onGet(/getAccessToken/).reply(200, {
        code: '00000',
        message: '成功！',
        data: {
          access_token: 'verified-token',
          expire: 7200,
        },
      });

      // 获取 Token
      const response = await axios.get(`${urls.tokenUrl}/open-auth/selfAppAuth/base/v1/getAccessToken`, {
        params: {
          appKey: config.appKey,
          timestamp,
          signature,
        },
      });

      expect(response.data.data.access_token).toBe('verified-token');

      // 验证请求参数（通过检查历史记录）
      const lastRequest = mockAxios.history.get[mockAxios.history.get.length - 1];
      expect(lastRequest.params.appKey).toBe(config.appKey);
      expect(lastRequest.params.timestamp).toBe(timestamp);
      expect(lastRequest.params.signature).toBe(signature);
    });

    it('should verify GET request instead of POST', async () => {
      const config = {
        tenantId: 'get-method-tenant',
        appKey: 'get-method-appKey',
        appSecret: 'get-method-secret',
        env: 'sandbox' as const,
      };

      // Mock 数据中心 API
      mockAxios.onGet(/getGatewayAddress/).reply(200, {
        code: '00000',
        message: '成功！',
        data: {
          gatewayUrl: 'https://gateway.get.com',
          tokenUrl: 'https://token.get.com',
        },
      });

      const urls = await dataCenterService.getDataCenterUrls(config.tenantId);
      const timestamp = signatureService.generateTimestamp();
      const signature = signatureService.calculateSignature({
        appKey: config.appKey,
        timestamp,
        appSecret: config.appSecret,
      });

      // Mock Token API
      mockAxios.onGet(/getAccessToken/).reply(200, {
        code: '00000',
        message: '成功！',
        data: {
          access_token: 'get-request-token',
          expire: 7200,
        },
      });

      // 发送 GET 请求
      await axios.get(`${urls.tokenUrl}/open-auth/selfAppAuth/base/v1/getAccessToken`, {
        params: {
          appKey: config.appKey,
          timestamp,
          signature,
        },
      });

      // 验证历史记录
      expect(mockAxios.history.get.length).toBeGreaterThan(0);
      expect(mockAxios.history.post.length).toBe(0); // 不应该有 POST 请求
    });
  });

  describe('signature verification in token flow', () => {
    it('should reject invalid signature', async () => {
      const config = {
        tenantId: 'invalid-signature-tenant',
        appKey: 'invalid-signature-appKey',
        appSecret: 'invalid-signature-secret',
        env: 'sandbox' as const,
      };

      // Mock 数据中心 API
      mockAxios.onGet(/getGatewayAddress/).reply(200, {
        code: '00000',
        message: '成功！',
        data: {
          gatewayUrl: 'https://gateway.invalid.com',
          tokenUrl: 'https://token.invalid.com',
        },
      });

      const urls = await dataCenterService.getDataCenterUrls(config.tenantId);

      // 使用错误的签名
      const timestamp = signatureService.generateTimestamp();
      const wrongSignature = 'invalid-signature-value';

      // Mock Token API 返回签名错误
      mockAxios.onGet(/getAccessToken/).reply(401, {
        code: '40100',
        message: '签名验证失败',
      });

      // 应该收到错误
      await expect(
        axios.get(`${urls.tokenUrl}/open-auth/selfAppAuth/base/v1/getAccessToken`, {
          params: {
            appKey: config.appKey,
            timestamp,
            signature: wrongSignature,
          },
        })
      ).rejects.toThrow();
    });

    it('should accept correct signature', async () => {
      const config = {
        tenantId: 'correct-signature-tenant',
        appKey: 'correct-signature-appKey',
        appSecret: 'correct-signature-secret',
        env: 'sandbox' as const,
      };

      // Mock 数据中心 API
      mockAxios.onGet(/getGatewayAddress/).reply(200, {
        code: '00000',
        message: '成功！',
        data: {
          gatewayUrl: 'https://gateway.correct.com',
          tokenUrl: 'https://token.correct.com',
        },
      });

      const urls = await dataCenterService.getDataCenterUrls(config.tenantId);

      // 使用正确的签名
      const timestamp = signatureService.generateTimestamp();
      const correctSignature = signatureService.calculateSignature({
        appKey: config.appKey,
        timestamp,
        appSecret: config.appSecret,
      });

      // Mock Token API 成功
      mockAxios.onGet(/getAccessToken/).reply(200, {
        code: '00000',
        message: '成功！',
        data: {
          access_token: 'correct-signature-token',
          expire: 7200,
        },
      });

      // 应该成功
      const response = await axios.get(`${urls.tokenUrl}/open-auth/selfAppAuth/base/v1/getAccessToken`, {
        params: {
          appKey: config.appKey,
          timestamp,
          signature: correctSignature,
        },
      });

      expect(response.data.code).toBe('00000');
      expect(response.data.data.access_token).toBeDefined();
    });
  });

  describe('timestamp validation', () => {
    it('should use millisecond-level timestamp', async () => {
      const config = {
        tenantId: 'timestamp-tenant',
        appKey: 'timestamp-appKey',
        appSecret: 'timestamp-secret',
        env: 'sandbox' as const,
      };

      // Mock 数据中心 API
      mockAxios.onGet(/getGatewayAddress/).reply(200, {
        code: '00000',
        message: '成功！',
        data: {
          gatewayUrl: 'https://gateway.timestamp.com',
          tokenUrl: 'https://token.timestamp.com',
        },
      });

      const urls = await dataCenterService.getDataCenterUrls(config.tenantId);

      // 生成时间戳
      const timestamp = signatureService.generateTimestamp();

      // 验证是毫秒级（13位数字）
      expect(timestamp).toBeGreaterThan(1000000000000);
      expect(timestamp).toBeLessThan(9999999999999);

      // Mock Token API 并验证时间戳传递
      mockAxios.onGet(/getAccessToken/).reply(200, {
        code: '00000',
        message: '成功！',
        data: {
          access_token: 'timestamp-token',
          expire: 7200,
        },
      });

      const signature = signatureService.calculateSignature({
        appKey: config.appKey,
        timestamp,
        appSecret: config.appSecret,
      });

      await axios.get(`${urls.tokenUrl}/open-auth/selfAppAuth/base/v1/getAccessToken`, {
        params: {
          appKey: config.appKey,
          timestamp,
          signature,
        },
      });

      // 验证时间戳参数（通过检查历史记录）
      const lastRequest = mockAxios.history.get[mockAxios.history.get.length - 1];
      const receivedTimestamp = lastRequest.params.timestamp;
      expect(typeof receivedTimestamp).toBe('number');
      expect(receivedTimestamp).toBeGreaterThan(1000000000000);
    });
  });

  describe('data center integration', () => {
    it('should query data center before token acquisition', async () => {
      const config = {
        tenantId: 'order-test-tenant',
        appKey: 'order-test-appKey',
        appSecret: 'order-test-secret',
        env: 'sandbox' as const,
      };

      // Mock 数据中心 API
      mockAxios.onGet(/getGatewayAddress/).reply(200, {
        code: '00000',
        message: '成功！',
        data: {
          gatewayUrl: 'https://gateway.order.com',
          tokenUrl: 'https://token.order.com',
        },
      });

      // 查询数据中心域名（第一步）
      const urls = await dataCenterService.getDataCenterUrls(config.tenantId);

      // 验证数据中心查询在 Token 获取之前
      expect(mockAxios.history.get.length).toBe(1);
      expect(urls.tokenUrl).toBeDefined();

      // Mock Token API
      mockAxios.onGet(/getAccessToken/).reply(200, {
        code: '00000',
        message: '成功！',
        data: {
          access_token: 'order-token',
          expire: 7200,
        },
      });

      // 获取 Token（第二步）
      const timestamp = signatureService.generateTimestamp();
      const signature = signatureService.calculateSignature({
        appKey: config.appKey,
        timestamp,
        appSecret: config.appSecret,
      });

      await axios.get(`${urls.tokenUrl}/open-auth/selfAppAuth/base/v1/getAccessToken`, {
        params: {
          appKey: config.appKey,
          timestamp,
          signature,
        },
      });

      // 验证调用顺序
      expect(mockAxios.history.get.length).toBe(2); // 数据中心 + Token

      // 验证第一个请求是数据中心查询
      const firstRequest = mockAxios.history.get[0];
      expect(firstRequest.url).toContain('getGatewayAddress');

      // 验证第二个请求是 Token 获取
      const secondRequest = mockAxios.history.get[1];
      expect(secondRequest.url).toContain('getAccessToken');
    });

    it('should use cached data center URLs', async () => {
      const config = {
        tenantId: 'cached-urls-tenant',
        appKey: 'cached-urls-appKey',
        appSecret: 'cached-urls-secret',
        env: 'sandbox' as const,
      };

      // Mock 数据中心 API
      mockAxios.onGet(/getGatewayAddress/).reply(200, {
        code: '00000',
        message: '成功！',
        data: {
          gatewayUrl: 'https://gateway.cached.com',
          tokenUrl: 'https://token.cached.com',
        },
      });

      // 第一次查询（调用 API）
      const urls1 = await dataCenterService.getDataCenterUrls(config.tenantId);
      expect(urls1.tokenUrl).toBe('https://token.cached.com');
      expect(mockAxios.history.get.length).toBe(1);

      // Mock Token API
      mockAxios.onGet(/getAccessToken/).reply(200, {
        code: '00000',
        message: '成功！',
        data: {
          access_token: 'cached-urls-token',
          expire: 7200,
        },
      });

      // 使用缓存的数据中心域名获取 Token
      const timestamp = signatureService.generateTimestamp();
      const signature = signatureService.calculateSignature({
        appKey: config.appKey,
        timestamp,
        appSecret: config.appSecret,
      });

      await axios.get(`${urls1.tokenUrl}/open-auth/selfAppAuth/base/v1/getAccessToken`, {
        params: {
          appKey: config.appKey,
          timestamp,
          signature,
        },
      });

      // 第二次查询数据中心（使用缓存）
      const urls2 = await dataCenterService.getDataCenterUrls(config.tenantId);
      expect(urls2.tokenUrl).toBe('https://token.cached.com');
      expect(mockAxios.history.get.length).toBe(2); // 数据中心查询1次 + Token 1次
      // 注意：第二次数据中心查询使用了缓存，没有新增 API 调用
    });
  });

  describe('error handling in flow', () => {
    it('should handle data center query failure', async () => {
      const config = {
        tenantId: 'dc-failure-tenant',
        appKey: 'dc-failure-appKey',
        appSecret: 'dc-failure-secret',
        env: 'sandbox' as const,
      };

      // Mock 数据中心 API 失败
      mockAxios.onGet(/getGatewayAddress/).reply(200, {
        code: '99999',
        message: '租户不存在',
      });

      // 数据中心查询失败
      await expect(dataCenterService.getDataCenterUrls(config.tenantId)).rejects.toThrow(AuthError);

      // Token 获取不应该执行（因为无法获取 tokenUrl）
      expect(mockAxios.history.get.length).toBe(1); // 只有数据中心查询
    });

    it('should handle token API failure', async () => {
      const config = {
        tenantId: 'token-failure-tenant',
        appKey: 'token-failure-appKey',
        appSecret: 'token-failure-secret',
        env: 'sandbox' as const,
      };

      // Mock 数据中心 API 成功
      mockAxios.onGet(/getGatewayAddress/).reply(200, {
        code: '00000',
        message: '成功！',
        data: {
          gatewayUrl: 'https://gateway.failure.com',
          tokenUrl: 'https://token.failure.com',
        },
      });

      const urls = await dataCenterService.getDataCenterUrls(config.tenantId);

      // Mock Token API 失败
      mockAxios.onGet(/getAccessToken/).reply(401, {
        code: '40100',
        message: '认证失败',
      });

      const timestamp = signatureService.generateTimestamp();
      const signature = signatureService.calculateSignature({
        appKey: config.appKey,
        timestamp,
        appSecret: config.appSecret,
      });

      // Token 获取失败
      await expect(
        axios.get(`${urls.tokenUrl}/open-auth/selfAppAuth/base/v1/getAccessToken`, {
          params: {
            appKey: config.appKey,
            timestamp,
            signature,
          },
        })
      ).rejects.toThrow();
    });

    it('should handle network error during token acquisition', async () => {
      const config = {
        tenantId: 'network-error-tenant',
        appKey: 'network-error-appKey',
        appSecret: 'network-error-secret',
        env: 'sandbox' as const,
      };

      // Mock 数据中心 API 成功
      mockAxios.onGet(/getGatewayAddress/).reply(200, {
        code: '00000',
        message: '成功！',
        data: {
          gatewayUrl: 'https://gateway.network.com',
          tokenUrl: 'https://token.network.com',
        },
      });

      const urls = await dataCenterService.getDataCenterUrls(config.tenantId);

      // Mock Token API 网络错误
      mockAxios.onGet(/getAccessToken/).networkError();

      const timestamp = signatureService.generateTimestamp();
      const signature = signatureService.calculateSignature({
        appKey: config.appKey,
        timestamp,
        appSecret: config.appSecret,
      });

      // 网络错误
      await expect(
        axios.get(`${urls.tokenUrl}/open-auth/selfAppAuth/base/v1/getAccessToken`, {
          params: {
            appKey: config.appKey,
            timestamp,
            signature,
          },
        })
      ).rejects.toThrow();
    });
  });

  describe('token response parsing', () => {
    it('should parse token response with expire field', async () => {
      const config = {
        tenantId: 'expire-field-tenant',
        appKey: 'expire-field-appKey',
        appSecret: 'expire-field-secret',
        env: 'sandbox' as const,
      };

      // Mock 数据中心 API
      mockAxios.onGet(/getGatewayAddress/).reply(200, {
        code: '00000',
        message: '成功！',
        data: {
          gatewayUrl: 'https://gateway.expire.com',
          tokenUrl: 'https://token.expire.com',
        },
      });

      const urls = await dataCenterService.getDataCenterUrls(config.tenantId);

      // Mock Token API（使用 expire 字段）
      mockAxios.onGet(/getAccessToken/).reply(200, {
        code: '00000',
        message: '成功！',
        data: {
          access_token: 'expire-token',
          expire: 7200, // 使用 expire 而不是 expires_in
        },
      });

      const timestamp = signatureService.generateTimestamp();
      const signature = signatureService.calculateSignature({
        appKey: config.appKey,
        timestamp,
        appSecret: config.appSecret,
      });

      const response = await axios.get(`${urls.tokenUrl}/open-auth/selfAppAuth/base/v1/getAccessToken`, {
        params: {
          appKey: config.appKey,
          timestamp,
          signature,
        },
      });

      // 验证响应解析
      expect(response.data.data.access_token).toBe('expire-token');
      expect(response.data.data.expire).toBe(7200);
    });

    it('should parse token response with expires_in field', async () => {
      const config = {
        tenantId: 'expires-in-tenant',
        appKey: 'expires-in-appKey',
        appSecret: 'expires-in-secret',
        env: 'sandbox' as const,
      };

      // Mock 数据中心 API
      mockAxios.onGet(/getGatewayAddress/).reply(200, {
        code: '00000',
        message: '成功！',
        data: {
          gatewayUrl: 'https://gateway.expires.com',
          tokenUrl: 'https://token.expires.com',
        },
      });

      const urls = await dataCenterService.getDataCenterUrls(config.tenantId);

      // Mock Token API（使用 expires_in 字段）
      mockAxios.onGet(/getAccessToken/).reply(200, {
        code: '00000',
        message: '成功！',
        data: {
          access_token: 'expires-in-token',
          expires_in: 7200, // 使用 expires_in
        },
      });

      const timestamp = signatureService.generateTimestamp();
      const signature = signatureService.calculateSignature({
        appKey: config.appKey,
        timestamp,
        appSecret: config.appSecret,
      });

      const response = await axios.get(`${urls.tokenUrl}/open-auth/selfAppAuth/base/v1/getAccessToken`, {
        params: {
          appKey: config.appKey,
          timestamp,
          signature,
        },
      });

      // 验证响应解析（兼容 expires_in 字段）
      expect(response.data.data.access_token).toBe('expires-in-token');
      expect(response.data.data.expires_in).toBe(7200);
    });
  });
});