/**
 * API 客户端服务
 *
 * 负责创建配置好的 API 客户端，自动注入正确的 baseURL 和 Token
 * 流程：获取 tenantId → 查询数据中心域名 → 获取 Token → 创建带正确 basePath 和 Token 的 API 客户端
 */

import { Configuration } from '../../api/generated';
import { DataCenterService } from '../auth/datacenter-service';
import { TokenManager } from '../auth/token-manager';
import { ConfigService } from '../config/config-service';
import { AuthError, AuthErrorReason } from '../error/errors';
import { TokenConfig } from '../../types/auth';

/**
 * API 客户端服务类
 *
 * 负责：
 * 1. 从配置获取 tenantId、appKey、appSecret
 * 2. 通过 DataCenterService 获取 gatewayUrl
 * 3. 通过 TokenManager 获取有效的 access_token
 * 4. 创建带有正确 basePath 和 accessToken 的 Configuration
 */
export class ApiClientService {
  private dataCenterService: DataCenterService;
  private tokenManager: TokenManager;
  private configService: ConfigService;
  private cachedGatewayUrl: string | undefined;

  constructor() {
    this.dataCenterService = new DataCenterService();
    this.tokenManager = new TokenManager();
    this.configService = new ConfigService();
  }

  /**
   * 获取带正确 basePath 和 Token 的 Configuration
   *
   * 流程：
   * 1. 从配置获取 tenantId、appKey、appSecret
   * 2. 查询数据中心域名获取 gatewayUrl
   * 3. 通过 TokenManager 获取有效的 access_token
   * 4. 返回配置好的 Configuration
   *
   * @returns 配置好的 Configuration
   * @throws AuthError 获取配置、域名或 Token 失败
   */
  async getConfiguration(): Promise<Configuration> {
    try {
      // 1. 获取配置
      const config = await this.configService.getConfig({ decryptSensitive: true });

      if (!config.tenantId) {
        throw new AuthError(
          AuthErrorReason.INVALID_CREDENTIALS,
          'Missing tenantId in configuration. Please run: ybc config init'
        );
      }

      const appKey = config.appKey;
      const appSecret = config.appSecret;

      if (!appKey || !appSecret) {
        throw new AuthError(
          AuthErrorReason.INVALID_CREDENTIALS,
          'Missing appKey/appSecret credentials'
        );
      }

      // 2. 获取 gatewayUrl（优先使用缓存）
      let gatewayUrl = this.cachedGatewayUrl;

      if (!gatewayUrl) {
        const urls = await this.dataCenterService.getDataCenterUrls(config.tenantId);
        gatewayUrl = urls.gatewayUrl;
        this.cachedGatewayUrl = gatewayUrl;
      }

      // 3. 获取有效的 access_token
      const tokenConfig: TokenConfig = {
        tenantId: config.tenantId,
        appKey: appKey,
        appSecret: appSecret,
        env: config.env || 'sandbox',
      };

      const accessToken = await this.tokenManager.getValidToken(tokenConfig);

      // 4. 返回配置好的 Configuration
      return new Configuration({
        basePath: gatewayUrl,
        accessToken: accessToken,
        baseOptions: {
          headers: {
            'Content-Type': 'application/json',
          },
        },
      });
    } catch (error) {
      if (error instanceof AuthError) {
        throw error;
      }
      throw new AuthError(
        AuthErrorReason.TOKEN_REFRESH_FAILED,
        'Failed to initialize API client',
        error as Error
      );
    }
  }

  /**
   * 清除缓存的 gatewayUrl
   * 用于强制刷新或配置变更后
   */
  clearCache(): void {
    this.cachedGatewayUrl = undefined;
  }
}