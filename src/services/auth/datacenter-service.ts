/**
 * 数据中心域名管理服务
 *
 * 负责查询和缓存租户所在数据中心的域名
 */

import * as os from 'os';
import * as path from 'path';
import axios, { AxiosInstance } from 'axios';
import { FileStorage } from '../../infrastructure/storage/file-storage';
import { DataCenterResponse, DataCenterCache } from '../../types/auth';
import { AuthError, AuthErrorReason } from '../error/errors';

const DATA_CENTER_API_URL = 'https://api.yonyoucloud.com';

export class DataCenterService {
  private storage: FileStorage;
  private cacheFilePath: string;
  private httpClient: AxiosInstance;

  constructor(storage?: FileStorage, httpClient?: AxiosInstance) {
    this.storage = storage || new FileStorage();
    this.cacheFilePath = path.join(os.homedir(), '.ybc', 'datacenter.json');
    this.httpClient = httpClient || axios;
  }

  /**
   * 获取数据中心域名
   *
   * 流程：
   * 1. 检查缓存（如果缓存存在且匹配tenantId，返回缓存）
   * 2. 否则调用API查询
   * 3. 验证响应 code === '00000'
   * 4. 保存到缓存（文件权限600）
   *
   * API: GET https://api.yonyoucloud.com/open-auth/dataCenter/getGatewayAddress?tenantId={tenantId}
   * 返回: { gatewayUrl, tokenUrl }
   *
   * @param tenantId 租户ID
   * @returns 数据中心域名信息 { gatewayUrl, tokenUrl }
   * @throws AuthError 查询失败或响应无效
   */
  async getDataCenterUrls(tenantId: string): Promise<{ gatewayUrl: string; tokenUrl: string }> {
    // 1. 检查缓存
    const cached = await this.loadFromCache(tenantId);
    if (cached) {
      return cached;
    }

    // 2. 调用API查询
    try {
      const response = await this.httpClient.get<DataCenterResponse>(
        `${DATA_CENTER_API_URL}/open-auth/dataCenter/getGatewayAddress`,
        {
          params: { tenantId },
          timeout: 30000,
          headers: { 'Content-Type': 'application/json' },
        }
      );

      if (response.data.code !== '00000') {
        throw new AuthError(
          AuthErrorReason.INVALID_CREDENTIALS,
          `Failed to get data center URLs: ${response.data.message}`
        );
      }

      // 验证数据完整性
      if (!response.data.data.gatewayUrl || !response.data.data.tokenUrl) {
        throw new AuthError(
          AuthErrorReason.TOKEN_REFRESH_FAILED,
          'Data center response missing required URLs (gatewayUrl or tokenUrl)'
        );
      }

      const urls = {
        gatewayUrl: response.data.data.gatewayUrl,
        tokenUrl: response.data.data.tokenUrl,
      };

      // 3. 保存到缓存
      await this.saveToCache(tenantId, urls);

      return urls;
    } catch (error) {
      if (error instanceof AuthError) {
        throw error;
      }
      throw new AuthError(
        AuthErrorReason.TOKEN_REFRESH_FAILED,
        'Failed to query data center URLs',
        error as Error
      );
    }
  }

  /**
   * 从缓存加载数据中心域名
   *
   * @param tenantId 租户ID
   * @returns 数据中心域名信息，如果缓存不存在或不匹配则返回 null
   */
  private async loadFromCache(
    tenantId: string
  ): Promise<{ gatewayUrl: string; tokenUrl: string } | null> {
    try {
      const exists = await this.storage.exists(this.cacheFilePath);
      if (!exists) return null;

      const cache = await this.storage.read(this.cacheFilePath);
      if (cache.tenantId === tenantId && cache.urls) {
        return cache.urls;
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * 保存数据中心域名到缓存
   *
   * @param tenantId 租户ID
   * @param urls 数据中心域名信息
   */
  private async saveToCache(
    tenantId: string,
    urls: { gatewayUrl: string; tokenUrl: string }
  ): Promise<void> {
    try {
      const cacheData: DataCenterCache = {
        tenantId,
        urls,
        lastUpdate: new Date().toISOString(),
      };

      // 保存到文件，权限设置为 600（仅用户可读写）
      await this.storage.write(this.cacheFilePath, cacheData, { mode: 0o600 });
    } catch {
      // 缓存保存失败不影响主流程，仅记录错误即可
      // 实际生产环境建议使用 logger 记录此错误
    }
  }

  /**
   * 清除缓存（用于测试或强制刷新）
   */
  async clearCache(): Promise<void> {
    try {
      const exists = await this.storage.exists(this.cacheFilePath);
      if (exists) {
        await this.storage.delete(this.cacheFilePath);
      }
    } catch {
      // 忽略删除错误（与 saveToCache 保持一致的错误处理策略）
    }
  }
}