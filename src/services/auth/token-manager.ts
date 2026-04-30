/**
 * Token 管理器
 *
 * 负责 Token 的自动获取、刷新、缓存和过期检查
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import * as os from 'os';
import * as path from 'path';
import * as crypto from 'crypto';
import axios, { AxiosInstance } from 'axios';
import { FileStorage } from '../../infrastructure/storage/file-storage';
import {
  TokenInfo,
  TokenConfig,
  TokenCache,
  BipTokenResponse,
  BipErrorResponse,
} from '../../types/auth';
import { AuthError, AuthErrorReason } from '../error/errors';
import { DataCenterService } from './datacenter-service';
import { SignatureService } from './signature-service';

/**
 * Token 提前刷新时间（秒）
 * 在过期前 5 分钟刷新
 */
const TOKEN_REFRESH_BUFFER = 5 * 60;

/**
 * Token 管理器类
 */
export class TokenManager {
  private readonly storage: FileStorage;
  private readonly cacheFilePath: string;
  private readonly httpClient: AxiosInstance;
  private readonly dataCenterService: DataCenterService;
  private readonly signatureService: SignatureService;
  private cachedToken: TokenInfo | null = null;

  /**
   * 构造函数
   * @param storage 文件存储服务
   * @param cacheFilePath 缓存文件路径（默认 ~/.ybc/token.json）
   * @param httpClient 可选的 HTTP 客户端（用于测试 mock）
   * @param dataCenterService 可选的数据中心服务（用于测试 mock）
   */
  constructor(
    storage?: FileStorage,
    cacheFilePath?: string,
    httpClient?: AxiosInstance,
    dataCenterService?: DataCenterService
  ) {
    this.storage = storage || new FileStorage();
    this.cacheFilePath = cacheFilePath || path.join(os.homedir(), '.ybc', 'token.json');

    // 创建或使用提供的 HTTP 客户端
    this.httpClient = httpClient || axios.create({
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // 初始化数据中心服务（注入 axios 实例用于测试）
    this.dataCenterService = dataCenterService || new DataCenterService(this.storage, this.httpClient);
    this.signatureService = new SignatureService();
  }

  /**
   * 获取有效的 Token
   * @param config Token 配置
   * @returns 访问令牌
   * @throws AuthError 获取 Token 失败
   */
  async getValidToken(config: TokenConfig): Promise<string> {
    try {
      // 1. 检查内存缓存
      if (this.cachedToken) {
        if (!this.isExpired(this.cachedToken)) {
          return this.cachedToken.access_token;
        }
        // 内存缓存已过期，清除
        this.cachedToken = null;
      }

      // 2. 从文件加载缓存
      const fileToken = await this.loadFromCache(config);
      if (fileToken) {
        if (!this.isExpired(fileToken)) {
          this.cachedToken = fileToken;
          return fileToken.access_token;
        }
        // 文件缓存已过期，继续获取新 token
      }

      // 3. 获取新 Token
      const newToken = await this.refreshToken(config);
      this.cachedToken = newToken;

      // 4. 保存到缓存
      await this.saveToCache(newToken, config);

      return newToken.access_token;
    } catch (error) {
      if (error instanceof AuthError) {
        throw error;
      }

      throw new AuthError(
        AuthErrorReason.TOKEN_REFRESH_FAILED,
        'Failed to get valid token',
        error as Error
      );
    }
  }

  /**
   * 刷新 Token
   * @param config Token 配置
   * @returns 新的 Token 信息
   * @throws AuthError 刷新失败
   */
  async refreshToken(config: TokenConfig): Promise<TokenInfo> {
    try {
      // 支持向后兼容：优先使用新字段名，如果不存在则使用旧字段名
      const appKey = config.appKey;
      const appSecret = config.appSecret;

      if (!appKey || !appSecret) {
        throw new AuthError(
          AuthErrorReason.INVALID_CREDENTIALS,
          'Missing appKey/appSecret credentials'
        );
      }

      // 👉 步骤 1: 获取数据中心域名（如果未提供）
      let tokenUrl = config.tokenUrl;
      if (!tokenUrl) {
        const urls = await this.dataCenterService.getDataCenterUrls(config.tenantId);
        tokenUrl = urls.tokenUrl;
      }

      // 👉 步骤 2: 生成时间戳（毫秒级）
      const timestamp = this.signatureService.generateTimestamp();

      // 👉 步骤 3: 计算签名
      const signature = this.signatureService.calculateSignature({
        appKey,
        timestamp,
        appSecret,
      });

      // 👉 步骤 4: 构建请求URL（GET方法）
      const requestUrl = `${tokenUrl}/open-auth/selfAppAuth/base/v1/getAccessToken`;

      // 👉 步骤 5: 发送GET请求
      const response = await this.httpClient.get<BipTokenResponse>(requestUrl, {
        params: {
          appKey,
          timestamp,
          signature,
        },
        headers: {
          'Content-Type': 'application/json', // 即使GET也需要此Header
        },
      });

      // 👉 步骤 6: 解析响应
      // 注意：响应可能有两种格式：
      // 1. 简化格式（直接返回）: { access_token, expires_in, ... }
      // 2. 完整格式（含code/message）: { code, message, data: { access_token, expires_in, ... } }
      const responseBody = response.data as unknown as Record<string, unknown>;
      const hasFullFormat = 'code' in responseBody && 'data' in responseBody;

      // 提取 access_token 和 expires_in
      let accessToken: string;
      let expiresIn: number;

      if (hasFullFormat) {
        const fullResponse = responseBody as { code: string; data?: { access_token: string; expires_in?: number; expire?: number } };
        accessToken = fullResponse.data?.access_token || '';
        expiresIn = fullResponse.data?.expires_in || fullResponse.data?.expire || 0;
      } else {
        // 简化格式
        const simpleResponse = responseBody as { access_token: string; expires_in?: number; expire?: number };
        accessToken = simpleResponse.access_token || '';
        expiresIn = simpleResponse.expires_in || simpleResponse.expire || 0;
      }

      if (!expiresIn) {
        throw new AuthError(
          AuthErrorReason.TOKEN_REFRESH_FAILED,
          'Token response missing expiration time'
        );
      }

      const expiresAt = Date.now() + expiresIn * 1000;

      const tokenInfo: TokenInfo = {
        access_token: accessToken,
        expires_in: expiresIn,
        expires_at: expiresAt,
        token_type: 'Bearer',
      };

      return tokenInfo;
    } catch (error) {
      // 处理 API 错误响应
      if (axios.isAxiosError(error) && error.response) {
        const errorData = error.response.data as BipErrorResponse;

        // 新 API 使用 code === '00000' 表示成功
        if (errorData?.code !== '00000' || error.response.status === 401) {
          throw new AuthError(
            AuthErrorReason.INVALID_CREDENTIALS,
            'Invalid appKey/appSecret credentials',
            error
          );
        }

        throw new AuthError(
          AuthErrorReason.TOKEN_REFRESH_FAILED,
          `Failed to refresh token: ${errorData?.message || error.message}`,
          error
        );
      }

      throw new AuthError(
        AuthErrorReason.TOKEN_REFRESH_FAILED,
        'Failed to refresh token due to network error',
        error as Error
      );
    }
  }

  /**
   * 从缓存加载 Token
   * @param config Token 配置
   * @returns Token 信息或 null
   */
  async loadFromCache(config: TokenConfig): Promise<TokenInfo | null> {
    try {
      // 检查缓存文件是否存在
      const exists = await this.storage.exists(this.cacheFilePath);
      if (!exists) {
        return null;
      }

      // 读取缓存
      const cache = (await this.storage.read(this.cacheFilePath)) as TokenCache;

      // 验证配置指纹
      const fingerprint = this.getConfigFingerprint(config);
      if (cache.configFingerprint !== fingerprint) {
        // 配置已变更，缓存无效
        return null;
      }

      return cache.token;
    } catch (error) {
      // 缓存读取失败，忽略并返回 null
      return null;
    }
  }

  /**
   * 保存 Token 到缓存
   * @param token Token 信息
   * @param config Token 配置
   */
  async saveToCache(token: TokenInfo, config: TokenConfig): Promise<void> {
    try {
      const fingerprint = this.getConfigFingerprint(config);

      const cache: TokenCache = {
        token,
        timestamp: Date.now(),
        configFingerprint: fingerprint,
      };

      // 更新内存缓存
      this.cachedToken = token;

      // 保存到文件（权限 600）
      await this.storage.write(this.cacheFilePath, cache, { mode: 0o600 });
    } catch (error) {
      // 缓存保存失败，抛出错误
      throw new AuthError(
        AuthErrorReason.TOKEN_CACHE_FAILED,
        'Failed to save token to cache',
        error as Error
      );
    }
  }

  /**
   * 检查 Token 是否过期
   * @param token Token 信息
   * @returns 是否过期（提前 5 分钟判定）
   */
  isExpired(token: TokenInfo): boolean {
    const now = Date.now();
    const bufferMs = TOKEN_REFRESH_BUFFER * 1000;

    // 提前 5 分钟判定为过期
    return token.expires_at <= now + bufferMs;
  }

  /**
   * 清除缓存
   */
  async clearCache(): Promise<void> {
    try {
      // 清除内存缓存
      this.cachedToken = null;

      // 清除文件缓存
      const exists = await this.storage.exists(this.cacheFilePath);
      if (exists) {
        await this.storage.delete(this.cacheFilePath);
      }
    } catch (error) {
      // 清除缓存失败，抛出错误
      throw new AuthError(
        AuthErrorReason.TOKEN_CACHE_FAILED,
        'Failed to clear token cache',
        error as Error
      );
    }
  }

  /**
   * 生成配置指纹
   * 用于验证缓存是否匹配当前配置
   * @param config Token 配置
   * @returns 指纹字符串
   */
  private getConfigFingerprint(config: TokenConfig): string {
    const data = `${config.tenantId}:${config.appKey}:${config.appSecret}:${config.env}`;
    return crypto.createHash('sha256').update(data).digest('hex');
  }
}
