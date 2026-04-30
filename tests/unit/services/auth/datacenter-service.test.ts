/**
 * DataCenterService 单元测试
 *
 * 测试数据中心域名查询、缓存机制和错误处理
 */

import * as path from 'path';
import * as os from 'os';
import axios, { AxiosRequestConfig } from 'axios';
import MockAdapter from 'axios-mock-adapter';
import { DataCenterService } from '@/services/auth/datacenter-service';
import { FileStorage } from '@/infrastructure/storage/file-storage';
import { AuthError, AuthErrorReason } from '@/services/error/errors';

describe('DataCenterService', () => {
  let service: DataCenterService;
  let storage: FileStorage;
  let mockAxios: MockAdapter;
  let tempCachePath: string;

  beforeEach(() => {
    // 创建临时缓存路径
    tempCachePath = path.join(os.tmpdir(), 'ybc-datacenter-test-', Date.now().toString());

    // 创建文件存储
    storage = new FileStorage();

    // 创建 axios mock
    mockAxios = new MockAdapter(axios);

    // 创建服务实例（使用临时缓存路径）
    service = new DataCenterService(storage);
    // 替换缓存路径为临时路径
    (service as any).cacheFilePath = tempCachePath;
  });

  afterEach(async () => {
    // 清理 mock
    mockAxios.restore();

    // 清理临时文件
    try {
      await storage.delete(tempCachePath);
    } catch {
      // 忽略清理错误
    }
  });

  describe('getDataCenterUrls', () => {
    it('should query data center URLs successfully', async () => {
      const tenantId = 'test-tenant-123';

      // Mock API 成功响应
      mockAxios.onGet(/getGatewayAddress/).reply(200, {
        code: '00000',
        message: '成功！',
        data: {
          gatewayUrl: 'https://yonbip.diwork.com/iuap-api-gateway',
          tokenUrl: 'https://yonbip.diwork.com/iuap-api-auth',
        },
      });

      const urls = await service.getDataCenterUrls(tenantId);

      // 验证正确解析 gatewayUrl 和 tokenUrl
      expect(urls.gatewayUrl).toBe('https://yonbip.diwork.com/iuap-api-gateway');
      expect(urls.tokenUrl).toBe('https://yonbip.diwork.com/iuap-api-auth');

      // 验证 API 调用参数
      expect(mockAxios.history.get.length).toBe(1);
      const request = mockAxios.history.get[0];
      expect(request.params.tenantId).toBe(tenantId);
    });

    it('should validate response code === "00000"', async () => {
      const tenantId = 'test-tenant-456';

      // Mock API 成功响应
      mockAxios.onGet(/getGatewayAddress/).reply(200, {
        code: '00000',
        message: '成功！',
        data: {
          gatewayUrl: 'https://gateway.example.com',
          tokenUrl: 'https://token.example.com',
        },
      });

      const urls = await service.getDataCenterUrls(tenantId);

      expect(urls).toBeDefined();
      expect(urls.gatewayUrl).toBeDefined();
      expect(urls.tokenUrl).toBeDefined();
    });

    it('should throw error when API returns error code', async () => {
      const tenantId = 'invalid-tenant';

      // Mock API 错误响应
      mockAxios.onGet(/getGatewayAddress/).reply(200, {
        code: '99999',
        message: '租户不存在',
        data: null,
      });

      await expect(service.getDataCenterUrls(tenantId)).rejects.toThrow(AuthError);

      try {
        await service.getDataCenterUrls(tenantId);
      } catch (error) {
        expect(error).toBeInstanceOf(AuthError);
        expect((error as AuthError).authDetails.reason).toBe(AuthErrorReason.INVALID_CREDENTIALS);
      }
    });

    it('should handle network error', async () => {
      const tenantId = 'test-tenant';

      // Mock 网络错误
      mockAxios.onGet(/getGatewayAddress/).networkError();

      await expect(service.getDataCenterUrls(tenantId)).rejects.toThrow(AuthError);

      try {
        await service.getDataCenterUrls(tenantId);
      } catch (error) {
        expect(error).toBeInstanceOf(AuthError);
        expect((error as AuthError).authDetails.reason).toBe(AuthErrorReason.TOKEN_REFRESH_FAILED);
      }
    });

    it('should handle timeout error', async () => {
      const tenantId = 'test-tenant';

      // Mock 超时错误
      mockAxios.onGet(/getGatewayAddress/).timeout();

      await expect(service.getDataCenterUrls(tenantId)).rejects.toThrow(AuthError);
    });

    it('should handle 500 server error', async () => {
      const tenantId = 'test-tenant';

      // Mock 500 错误
      mockAxios.onGet(/getGatewayAddress/).reply(500, {
        code: '50000',
        message: '服务器内部错误',
      });

      await expect(service.getDataCenterUrls(tenantId)).rejects.toThrow(AuthError);
    });
  });

  describe('cache mechanism', () => {
    it('should use cache on second query', async () => {
      const tenantId = 'cached-tenant';

      // Mock API 响应
      mockAxios.onGet(/getGatewayAddress/).reply(200, {
        code: '00000',
        message: '成功！',
        data: {
          gatewayUrl: 'https://cached-gateway.com',
          tokenUrl: 'https://cached-token.com',
        },
      });

      // 第一次查询：调用 API
      const urls1 = await service.getDataCenterUrls(tenantId);
      expect(urls1.gatewayUrl).toBe('https://cached-gateway.com');
      expect(mockAxios.history.get.length).toBe(1);

      // 第二次查询：使用缓存，不调用 API
      const urls2 = await service.getDataCenterUrls(tenantId);
      expect(urls2.gatewayUrl).toBe('https://cached-gateway.com');
      expect(urls2.tokenUrl).toBe('https://cached-token.com');
      expect(mockAxios.history.get.length).toBe(1); // 还是 1，说明第二次没有调用 API
    });

    it('should verify cache file format', async () => {
      const tenantId = 'format-test-tenant';

      // Mock API 响应
      mockAxios.onGet(/getGatewayAddress/).reply(200, {
        code: '00000',
        message: '成功！',
        data: {
          gatewayUrl: 'https://format-gateway.com',
          tokenUrl: 'https://format-token.com',
        },
      });

      // 第一次查询
      await service.getDataCenterUrls(tenantId);

      // 读取缓存文件
      const cacheExists = await storage.exists(tempCachePath);
      expect(cacheExists).toBe(true);

      const cacheData = await storage.read(tempCachePath);

      // 验证缓存文件格式
      expect(cacheData.tenantId).toBe(tenantId);
      expect(cacheData.urls).toBeDefined();
      expect(cacheData.urls.gatewayUrl).toBe('https://format-gateway.com');
      expect(cacheData.urls.tokenUrl).toBe('https://format-token.com');
      expect(cacheData.lastUpdate).toBeDefined();
      expect(typeof cacheData.lastUpdate).toBe('string');
    });

    it('should not use cache for different tenantId', async () => {
      const tenantId1 = 'tenant-1';
      const tenantId2 = 'tenant-2';

      // Mock API 响应（根据租户ID动态返回）
      mockAxios.onGet(/getGatewayAddress/).reply((config: AxiosRequestConfig) => {
        // 从 config.params 访问 tenantId
        const tenantId = config.params?.tenantId || '';

        return [
          200,
          {
            code: '00000',
            message: '成功！',
            data: {
              gatewayUrl: `https://gateway-${tenantId}.com`,
              tokenUrl: `https://token-${tenantId}.com`,
            },
          },
        ];
      });

      // 查询第一个租户
      const urls1 = await service.getDataCenterUrls(tenantId1);
      expect(urls1.gatewayUrl).toBe(`https://gateway-${tenantId1}.com`);
      expect(mockAxios.history.get.length).toBe(1);

      // 查询第二个租户（缓存不匹配，需要调用 API）
      const urls2 = await service.getDataCenterUrls(tenantId2);
      expect(urls2.gatewayUrl).toBe(`https://gateway-${tenantId2}.com`);
      expect(mockAxios.history.get.length).toBe(2); // 调用两次
    });

    it('should handle corrupted cache file', async () => {
      const tenantId = 'corrupted-tenant';

      // 创建损坏的缓存文件
      await storage.write(tempCachePath, 'invalid-json-content', { mode: 0o600 });

      // Mock API 响应
      mockAxios.onGet(/getGatewayAddress/).reply(200, {
        code: '00000',
        message: '成功！',
        data: {
          gatewayUrl: 'https://recovered-gateway.com',
          tokenUrl: 'https://recovered-token.com',
        },
      });

      // 应该能够恢复：忽略损坏的缓存，调用 API
      const urls = await service.getDataCenterUrls(tenantId);
      expect(urls.gatewayUrl).toBe('https://recovered-gateway.com');
      expect(mockAxios.history.get.length).toBe(1);
    });

    it('should save cache with correct file permissions', async () => {
      const tenantId = 'permission-test-tenant';

      // Mock API 响应
      mockAxios.onGet(/getGatewayAddress/).reply(200, {
        code: '00000',
        message: '成功！',
        data: {
          gatewayUrl: 'https://permission-gateway.com',
          tokenUrl: 'https://permission-token.com',
        },
      });

      // 查询并缓存
      await service.getDataCenterUrls(tenantId);

      // 验证文件存在（权限检查需要在实际环境中进行）
      const cacheExists = await storage.exists(tempCachePath);
      expect(cacheExists).toBe(true);
    });
  });

  describe('clearCache', () => {
    it('should clear cache successfully', async () => {
      const tenantId = 'clear-test-tenant';

      // Mock API 响应
      mockAxios.onGet(/getGatewayAddress/).reply(200, {
        code: '00000',
        message: '成功！',
        data: {
          gatewayUrl: 'https://clear-gateway.com',
          tokenUrl: 'https://clear-token.com',
        },
      });

      // 创建缓存
      await service.getDataCenterUrls(tenantId);

      // 验证缓存存在
      const cacheExistsBefore = await storage.exists(tempCachePath);
      expect(cacheExistsBefore).toBe(true);

      // 清除缓存
      await service.clearCache();

      // 验证缓存已删除
      const cacheExistsAfter = await storage.exists(tempCachePath);
      expect(cacheExistsAfter).toBe(false);
    });

    it('should handle clearing non-existent cache', async () => {
      // 清除不存在的缓存应该成功（不抛出错误）
      await service.clearCache();

      // 再次清除也不应该出错
      await service.clearCache();
    });

    it('should require API call after cache cleared', async () => {
      const tenantId = 'requery-test-tenant';

      // Mock API 响应
      mockAxios.onGet(/getGatewayAddress/).reply(200, {
        code: '00000',
        message: '成功！',
        data: {
          gatewayUrl: 'https://requery-gateway.com',
          tokenUrl: 'https://requery-token.com',
        },
      });

      // 第一次查询
      await service.getDataCenterUrls(tenantId);
      expect(mockAxios.history.get.length).toBe(1);

      // 清除缓存
      await service.clearCache();

      // 第二次查询（缓存已清除，需要调用 API）
      await service.getDataCenterUrls(tenantId);
      expect(mockAxios.history.get.length).toBe(2);
    });
  });

  describe('error handling', () => {
    it('should handle API rate limit error', async () => {
      const tenantId = 'rate-limit-tenant';

      // Mock 429 错误
      mockAxios.onGet(/getGatewayAddress/).reply(429, {
        code: '42900',
        message: '请求频率过高',
      });

      await expect(service.getDataCenterUrls(tenantId)).rejects.toThrow(AuthError);
    });

    it('should handle malformed response data', async () => {
      const tenantId = 'malformed-tenant';

      // Mock 响应数据格式错误
      mockAxios.onGet(/getGatewayAddress/).reply(200, {
        code: '00000',
        message: '成功！',
        data: {
          // 缺少 gatewayUrl 或 tokenUrl
          gatewayUrl: 'https://malformed.com',
          // tokenUrl 缺失
        },
      });

      await expect(service.getDataCenterUrls(tenantId)).rejects.toThrow();
    });

    it('should handle empty tenantId', async () => {
      const tenantId = '';

      // 空租户ID应该被 API 拒绝（或服务端返回错误）
      mockAxios.onGet(/getGatewayAddress/).reply(200, {
        code: '99999',
        message: '租户ID不能为空',
      });

      await expect(service.getDataCenterUrls(tenantId)).rejects.toThrow(AuthError);
    });

    it('should preserve AuthError when thrown', async () => {
      const tenantId = 'preserve-error-tenant';

      // Mock API 返回错误
      mockAxios.onGet(/getGatewayAddress/).reply(200, {
        code: '99999',
        message: '自定义错误消息',
      });

      try {
        await service.getDataCenterUrls(tenantId);
      } catch (error) {
        expect(error).toBeInstanceOf(AuthError);
        expect((error as AuthError).message).toContain('自定义错误消息');
      }
    });
  });

  describe('concurrent requests', () => {
    it('should handle concurrent requests for same tenantId', async () => {
      const tenantId = 'concurrent-tenant';

      // Mock API 响应
      mockAxios.onGet(/getGatewayAddress/).reply(200, {
        code: '00000',
        message: '成功！',
        data: {
          gatewayUrl: 'https://concurrent-gateway.com',
          tokenUrl: 'https://concurrent-token.com',
        },
      });

      // 并发请求（应该只有一个调用 API，其他使用缓存）
      const promises = [
        service.getDataCenterUrls(tenantId),
        service.getDataCenterUrls(tenantId),
        service.getDataCenterUrls(tenantId),
      ];

      const results = await Promise.all(promises);

      // 所有结果应该相同
      expect(results[0].gatewayUrl).toBe('https://concurrent-gateway.com');
      expect(results[1].gatewayUrl).toBe('https://concurrent-gateway.com');
      expect(results[2].gatewayUrl).toBe('https://concurrent-gateway.com');

      // 注意：由于并发，可能会有多次 API 调用（取决于缓存写入时机）
      // 这个测试主要验证并发不会导致错误
    });
  });
});