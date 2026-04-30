/**
 * HTTP 客户端工厂单元测试
 */

import axios from 'axios';
import { HttpClientFactory, createHttpClientFactory } from '../../../../src/infrastructure/http/http-client';
import { HttpClientConfig, HttpInterceptor } from '../../../../src/types/http';

jest.mock('axios');

describe('HttpClientFactory', () => {
  let factory: HttpClientFactory;
  let mockAxiosCreate: jest.Mock;

  beforeEach(() => {
    factory = new HttpClientFactory();
    mockAxiosCreate = axios.create as jest.Mock;
    mockAxiosCreate.mockClear();
  });

  describe('createClient', () => {
    it('应该创建带有默认配置的 Axios 实例', () => {
      const mockClient = {
        interceptors: {
          request: { use: jest.fn() },
          response: { use: jest.fn() },
        },
      };
      mockAxiosCreate.mockReturnValue(mockClient);

      const config: HttpClientConfig = {
        baseURL: 'https://api.example.com',
      };

      const client = factory.createClient(config);

      expect(mockAxiosCreate).toHaveBeenCalledWith({
        baseURL: 'https://api.example.com',
        timeout: 30000,
        headers: {
          'Content-Type': 'application/json',
        },
        httpsAgent: expect.any(Object),
      });

      expect(client).toBe(mockClient);
    });

    it('应该使用自定义超时时间', () => {
      const mockClient = {
        interceptors: {
          request: { use: jest.fn() },
          response: { use: jest.fn() },
        },
      };
      mockAxiosCreate.mockReturnValue(mockClient);

      const config: HttpClientConfig = {
        baseURL: 'https://api.example.com',
        timeout: 60000,
      };

      factory.createClient(config);

      expect(mockAxiosCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          timeout: 60000,
        })
      );
    });

    it('应该使用自定义请求头', () => {
      const mockClient = {
        interceptors: {
          request: { use: jest.fn() },
          response: { use: jest.fn() },
        },
      };
      mockAxiosCreate.mockReturnValue(mockClient);

      const config: HttpClientConfig = {
        baseURL: 'https://api.example.com',
        headers: {
          'X-Custom-Header': 'custom-value',
        },
      };

      factory.createClient(config);

      expect(mockAxiosCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          headers: {
            'Content-Type': 'application/json',
            'X-Custom-Header': 'custom-value',
          },
        })
      );
    });

    it('应该配置 HTTPS Agent', () => {
      const mockClient = {
        interceptors: {
          request: { use: jest.fn() },
          response: { use: jest.fn() },
        },
      };
      mockAxiosCreate.mockReturnValue(mockClient);

      const config: HttpClientConfig = {
        baseURL: 'https://api.example.com',
      };

      factory.createClient(config);

      const createCall = mockAxiosCreate.mock.calls[0][0];
      expect(createCall.httpsAgent).toBeDefined();
      expect(createCall.httpsAgent.options.rejectUnauthorized).toBe(true);
    });

    it('应该允许禁用 HTTPS 证书校验', () => {
      const mockClient = {
        interceptors: {
          request: { use: jest.fn() },
          response: { use: jest.fn() },
        },
      };
      mockAxiosCreate.mockReturnValue(mockClient);

      const config: HttpClientConfig = {
        baseURL: 'https://api.example.com',
        httpsAgent: false,
      };

      factory.createClient(config);

      const createCall = mockAxiosCreate.mock.calls[0][0];
      expect(createCall.httpsAgent.options.rejectUnauthorized).toBe(false);
    });
  });

  describe('addGlobalInterceptor', () => {
    it('应该添加请求拦截器', () => {
      const mockClient = {
        interceptors: {
          request: { use: jest.fn() },
          response: { use: jest.fn() },
        },
      };
      mockAxiosCreate.mockReturnValue(mockClient);

      const interceptor: HttpInterceptor = {
        request: {
          onFulfilled: (config) => config,
          onRejected: (error) => error,
        },
      };

      factory.addGlobalInterceptor(interceptor);
      factory.createClient({ baseURL: 'https://api.example.com' });

      expect(mockClient.interceptors.request.use).toHaveBeenCalledWith(
        interceptor.request?.onFulfilled,
        interceptor.request?.onRejected
      );
    });

    it('应该添加响应拦截器', () => {
      const mockClient = {
        interceptors: {
          request: { use: jest.fn() },
          response: { use: jest.fn() },
        },
      };
      mockAxiosCreate.mockReturnValue(mockClient);

      const interceptor: HttpInterceptor = {
        response: {
          onFulfilled: (response) => response,
          onRejected: (error) => error,
        },
      };

      factory.addGlobalInterceptor(interceptor);
      factory.createClient({ baseURL: 'https://api.example.com' });

      expect(mockClient.interceptors.response.use).toHaveBeenCalledWith(
        interceptor.response?.onFulfilled,
        interceptor.response?.onRejected
      );
    });

    it('应该添加多个拦截器', () => {
      const mockClient = {
        interceptors: {
          request: { use: jest.fn() },
          response: { use: jest.fn() },
        },
      };
      mockAxiosCreate.mockReturnValue(mockClient);

      const interceptor1: HttpInterceptor = {
        request: {
          onFulfilled: (config) => config,
        },
      };

      const interceptor2: HttpInterceptor = {
        response: {
          onFulfilled: (response) => response,
        },
      };

      factory.addGlobalInterceptor(interceptor1);
      factory.addGlobalInterceptor(interceptor2);
      factory.createClient({ baseURL: 'https://api.example.com' });

      expect(mockClient.interceptors.request.use).toHaveBeenCalledTimes(1);
      expect(mockClient.interceptors.response.use).toHaveBeenCalledTimes(1);
    });
  });

  describe('createHttpClientFactory', () => {
    it('应该创建 HttpClientFactory 实例', () => {
      const instance = createHttpClientFactory();

      expect(instance).toBeInstanceOf(HttpClientFactory);
    });
  });
});