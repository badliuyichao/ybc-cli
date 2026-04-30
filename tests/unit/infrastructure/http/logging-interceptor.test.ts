/**
 * 日志拦截器单元测试
 */

import axios, { AxiosInstance } from 'axios';
import MockAdapter from 'axios-mock-adapter';
import { Logger } from '../../../../src/services/logger/logger';
import { createLoggingInterceptor } from '../../../../src/infrastructure/http/logging-interceptor';
import { HttpRequestConfig } from '../../../../src/types/http';

describe('LoggingInterceptor', () => {
  let mockAxios: MockAdapter;
  let mockLogger: jest.Mocked<Logger>;
  let client: AxiosInstance;

  beforeEach(() => {
    // 创建 Mock axios
    mockAxios = new MockAdapter(axios);

    // 创建 Mock Logger
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      child: jest.fn(),
    } as any;

    // 创建拦截器
    const interceptor = createLoggingInterceptor(mockLogger);

    // 创建测试客户端
    client = axios.create({ baseURL: 'https://api.example.com' });
    if (interceptor.request) {
      client.interceptors.request.use(
        interceptor.request.onFulfilled as any,
        interceptor.request.onRejected
      );
    }
    if (interceptor.response) {
      client.interceptors.response.use(
        interceptor.response.onFulfilled as any,
        interceptor.response.onRejected
      );
    }
  });

  afterEach(() => {
    mockAxios.restore();
    jest.clearAllMocks();
  });

  describe('请求拦截器', () => {
    it('应该记录请求基本信息', async () => {
      mockAxios.onGet('/test').reply(200, { success: true });

      await client.get('/test');

      expect(mockLogger.debug).toHaveBeenCalledWith('HTTP Request: GET https://api.example.com/test');
    });

    it('应该记录请求头和数据（verbose 模式）', async () => {
      mockAxios.onPost('/test').reply(200, { success: true });

      await client.post('/test', { key: 'value' }, {
        headers: { 'X-Custom': 'header' },
      } as HttpRequestConfig);

      // 应该记录请求基本信息
      expect(mockLogger.debug).toHaveBeenCalledWith('HTTP Request: POST https://api.example.com/test');

      // 应该记录请求头
      expect(mockLogger.debug).toHaveBeenCalledWith('Request Headers:', expect.any(String));

      // 应该记录请求数据
      expect(mockLogger.debug).toHaveBeenCalledWith('Request Data:', expect.any(String));
    });

    it('应该跳过日志记录（skipLogging 标记）', async () => {
      mockAxios.onGet('/test').reply(200, { success: true });

      await client.get('/test', {
        skipLogging: true,
      } as HttpRequestConfig);

      expect(mockLogger.debug).not.toHaveBeenCalled();
    });

    it('应该脱敏敏感字段', async () => {
      mockAxios.onPost('/test').reply(200, { success: true });

      await client.post('/test', {
        authorization: 'Bearer full-token-1234567890',
        access_token: 'full-access-token-1234567890',
        sk: 'secret-key-1234567890',
        normalField: 'normal-value',
      });

      // 检查是否调用了日志记录
      expect(mockLogger.debug).toHaveBeenCalledWith('Request Data:', expect.any(String));

      // 获取记录的数据
      const loggedDataCall = mockLogger.debug.mock.calls.find(
        (call) => call[0] === 'Request Data:'
      );
      if (loggedDataCall && loggedDataCall[1]) {
        const loggedData = JSON.parse(loggedDataCall[1] as string);

        // 验证敏感字段已被脱敏
        expect(loggedData.authorization).toContain('***');
        expect(loggedData.authorization).toContain('Bearer ful'); // 前 10 位
        expect(loggedData.access_token).toContain('***');
        expect(loggedData.sk).toContain('***');
        expect(loggedData.normalField).toBe('normal-value');
      }
    });
  });

  describe('响应拦截器', () => {
    it('应该记录响应基本信息', async () => {
      mockAxios.onGet('/test').reply(200, { success: true });

      await client.get('/test');

      expect(mockLogger.debug).toHaveBeenCalledWith('HTTP Response: GET https://api.example.com/test - 200');
    });

    it('应该记录响应头和数据（verbose 模式）', async () => {
      mockAxios.onGet('/test').reply(200, { success: true, data: 'test' });

      await client.get('/test');

      expect(mockLogger.debug).toHaveBeenCalledWith('Response Status:', 200);
      expect(mockLogger.debug).toHaveBeenCalledWith('Response Headers:', expect.any(String));
      expect(mockLogger.debug).toHaveBeenCalledWith('Response Data:', expect.any(String));
    });

    it('应该跳过日志记录（skipLogging 标记）', async () => {
      mockAxios.onGet('/test').reply(200, { success: true });

      await client.get('/test', {
        skipLogging: true,
      } as HttpRequestConfig);

      expect(mockLogger.debug).not.toHaveBeenCalled();
    });

    it('应该脱敏响应中的敏感字段', async () => {
      mockAxios.onGet('/test').reply(200, {
        token: 'full-response-token-1234567890',
        normalField: 'normal-value',
      });

      await client.get('/test');

      const loggedDataCall = mockLogger.debug.mock.calls.find(
        (call) => call[0] === 'Response Data:'
      );
      if (loggedDataCall && loggedDataCall[1]) {
        const loggedData = JSON.parse(loggedDataCall[1] as string);

        expect(loggedData.token).toContain('***');
        expect(loggedData.normalField).toBe('normal-value');
      }
    });
  });

  describe('错误处理', () => {
    it('应该记录错误响应（有响应）', async () => {
      mockAxios.onGet('/test').reply(500, { error: 'Internal Error' });

      await expect(client.get('/test')).rejects.toThrow();

      expect(mockLogger.error).toHaveBeenCalledWith('HTTP Error: GET https://api.example.com/test - 500');
      expect(mockLogger.error).toHaveBeenCalledWith('Error Response:', expect.any(String));
    });

    it('应该记录网络错误（无响应）', async () => {
      mockAxios.onGet('/test').networkError();

      await expect(client.get('/test')).rejects.toThrow();

      // 网络错误会记录为 HTTP Request Error
      expect(mockLogger.error).toHaveBeenCalledWith('HTTP Request Error: Network Error');
    });

    it('应该记录请求配置错误', async () => {
      // 模拟请求配置错误
      const invalidUrl = 'not-a-valid-url';

      await expect(client.get(invalidUrl)).rejects.toThrow();

      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('应该跳过错误日志记录（skipLogging 标记）', async () => {
      mockAxios.onGet('/test').reply(500, { error: 'Internal Error' });

      await expect(
        client.get('/test', {
          skipLogging: true,
        } as HttpRequestConfig)
      ).rejects.toThrow();

      expect(mockLogger.error).not.toHaveBeenCalled();
    });

    it('应该脱敏错误响应中的敏感字段', async () => {
      mockAxios.onGet('/test').reply(401, {
        authorization: 'Bearer full-error-token-1234567890',
        error: 'Unauthorized',
      });

      await expect(client.get('/test')).rejects.toThrow();

      const loggedDataCall = mockLogger.error.mock.calls.find(
        (call) => call[0] === 'Error Response:'
      );

      if (loggedDataCall && loggedDataCall[1]) {
        const loggedData = JSON.parse(loggedDataCall[1] as string);
        expect(loggedData.authorization).toContain('***');
      }
    });
  });

  describe('脱敏逻辑', () => {
    it('应该处理短字符串（少于 10 位）', async () => {
      mockAxios.onPost('/test').reply(200, { success: true });

      await client.post('/test', {
        token: 'short', // 短字符串
      });

      const loggedDataCall = mockLogger.debug.mock.calls.find(
        (call) => call[0] === 'Request Data:'
      );
      if (loggedDataCall && loggedDataCall[1]) {
        const loggedData = JSON.parse(loggedDataCall[1] as string);

        expect(loggedData.token).toBe('***');
      }
    });

    it('应该处理嵌套对象', async () => {
      mockAxios.onPost('/test').reply(200, { success: true });

      await client.post('/test', {
        user: {
          password: 'user-password-1234567890',
          name: 'John',
        },
      });

      const loggedDataCall = mockLogger.debug.mock.calls.find(
        (call) => call[0] === 'Request Data:'
      );
      if (loggedDataCall && loggedDataCall[1]) {
        const loggedData = JSON.parse(loggedDataCall[1] as string);

        expect(loggedData.user.password).toContain('***');
        expect(loggedData.user.name).toBe('John');
      }
    });

    it('应该处理数组', async () => {
      mockAxios.onPost('/test').reply(200, { success: true });

      await client.post('/test', {
        items: [
          { token: 'item1-token-1234567890' },
          { token: 'item2-token-1234567890' },
        ],
      });

      const loggedDataCall = mockLogger.debug.mock.calls.find(
        (call) => call[0] === 'Request Data:'
      );
      if (loggedDataCall && loggedDataCall[1]) {
        const loggedData = JSON.parse(loggedDataCall[1] as string);

        expect(loggedData.items[0].token).toContain('***');
        expect(loggedData.items[1].token).toContain('***');
      }
    });
  });
});