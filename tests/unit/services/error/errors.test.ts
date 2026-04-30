import {
  CliError,
  AuthError,
  AuthErrorReason,
  NetworkError,
  BusinessError,
  ValidationError,
  isCliError,
  isAuthError,
  isNetworkError,
  isBusinessError,
  isValidationError,
} from '@/services/error/errors';
import { ExitCode } from '@/services/error/codes';

describe('错误类', () => {
  describe('CliError', () => {
    it('应该创建基本的 CLI 错误', () => {
      const error = new CliError('测试错误');

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(CliError);
      expect(error.name).toBe('CliError');
      expect(error.message).toBe('测试错误');
      expect(error.exitCode).toBe(ExitCode.GENERAL_ERROR);
      expect(error.details).toBeUndefined();
    });

    it('应该支持自定义退出码', () => {
      const error = new CliError('测试错误', ExitCode.BUSINESS_ERROR);

      expect(error.exitCode).toBe(ExitCode.BUSINESS_ERROR);
    });

    it('应该支持错误详情', () => {
      const details = { code: 'TEST_ERROR', timestamp: '2023-01-01' };
      const error = new CliError('测试错误', ExitCode.GENERAL_ERROR, details);

      expect(error.details).toEqual(details);
    });

    it('应该返回用户友好的错误消息', () => {
      const error = new CliError('测试错误');

      expect(error.getUserFriendlyMessage()).toBe('测试错误');
    });

    it('应该返回默认的恢复建议', () => {
      const error = new CliError('测试错误');

      expect(error.getRecoverySuggestion()).toContain('--help');
    });
  });

  describe('AuthError', () => {
    it('应该创建鉴权错误', () => {
      const error = new AuthError(AuthErrorReason.INVALID_CREDENTIALS, '鉴权失败');

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(CliError);
      expect(error).toBeInstanceOf(AuthError);
      expect(error.name).toBe('AuthError');
      expect(error.exitCode).toBe(ExitCode.AUTH_ERROR);
      expect(error.authDetails.reason).toBe('invalid_credentials');
    });

    it('应该为 invalid_credentials 提供友好的错误消息', () => {
      const error = new AuthError(AuthErrorReason.INVALID_CREDENTIALS, '无效的凭证');

      expect(error.getUserFriendlyMessage()).toContain('App Key 或 App Secret 无效');
    });

    it('应该为 token_expired 提供友好的错误消息', () => {
      const error = new AuthError(AuthErrorReason.TOKEN_EXPIRED, '令牌过期');

      expect(error.getUserFriendlyMessage()).toContain('访问令牌已过期');
    });

    it('应该为 token_refresh_failed 提供友好的错误消息', () => {
      const error = new AuthError(AuthErrorReason.TOKEN_REFRESH_FAILED, '令牌刷新失败');

      expect(error.getUserFriendlyMessage()).toContain('无法刷新访问令牌');
    });

    it('应该为 permission_denied 提供友好的错误消息', () => {
      const error = new AuthError(AuthErrorReason.PERMISSION_DENIED, '权限不足');

      expect(error.getUserFriendlyMessage()).toContain('权限不足');
    });

    it('应该提供针对性的恢复建议', () => {
      const error = new AuthError(AuthErrorReason.INVALID_CREDENTIALS, '鉴权失败');

      const suggestion = error.getRecoverySuggestion();

      expect(suggestion).toContain('App Key');
      expect(suggestion).toContain('config set appKey');
    });

    it('绝不在错误消息中暴露 appSecret', () => {
      const error = new AuthError(AuthErrorReason.INVALID_CREDENTIALS, '鉴权失败', undefined, {
        appSecret: 'secret-key-12345', // 敏感信息
      });

      const message = error.getUserFriendlyMessage();
      const suggestion = error.getRecoverySuggestion();

      expect(message).not.toContain('secret-key-12345');
      expect(suggestion).not.toContain('secret-key-12345');
    });

    it('应该为未知 reason 提供默认的错误消息', () => {
      const error = new AuthError('unknown_reason' as AuthErrorReason, '自定义错误');

      expect(error.getUserFriendlyMessage()).toBe('自定义错误');
    });

    it('应该为未知 reason 提供默认的恢复建议', () => {
      const error = new AuthError('unknown_reason' as AuthErrorReason, '自定义错误');

      expect(error.getRecoverySuggestion()).toContain('auth status');
    });

    it('应该支持 cause 参数', () => {
      const originalError = new Error('原始错误');
      const error = new AuthError(AuthErrorReason.INVALID_CREDENTIALS, '鉴权失败', originalError);

      expect(error.authDetails.originalError).toBe(originalError);
    });
  });

  describe('NetworkError', () => {
    it('应该创建网络错误', () => {
      const error = new NetworkError('网络请求失败');

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(CliError);
      expect(error).toBeInstanceOf(NetworkError);
      expect(error.name).toBe('NetworkError');
      expect(error.exitCode).toBe(ExitCode.NETWORK_ERROR);
    });

    it('应该为超时错误提供友好的错误消息', () => {
      const error = new NetworkError('请求超时', {
        isTimeout: true,
        url: 'https://api.example.com',
      });

      expect(error.getUserFriendlyMessage()).toContain('请求超时');
      expect(error.getUserFriendlyMessage()).toContain('api.example.com');
    });

    it('应该为连接错误提供友好的错误消息', () => {
      const error = new NetworkError('连接失败', {
        isConnectionError: true,
      });

      expect(error.getUserFriendlyMessage()).toContain('连接失败');
    });

    it('应该提供针对性的恢复建议', () => {
      const timeoutError = new NetworkError('超时', { isTimeout: true });
      const connectionError = new NetworkError('连接失败', {
        isConnectionError: true,
      });

      expect(timeoutError.getRecoverySuggestion()).toContain('超时');
      expect(connectionError.getRecoverySuggestion()).toContain('网络连接');
    });

    it('应该为未知网络错误提供默认的错误消息', () => {
      const error = new NetworkError('网络错误', {});

      expect(error.getUserFriendlyMessage()).toBe('网络错误');
    });

    it('应该为未知网络错误提供默认的恢复建议', () => {
      const error = new NetworkError('网络错误', {});

      expect(error.getRecoverySuggestion()).toContain('技术支持');
    });
  });

  describe('BusinessError', () => {
    it('应该创建业务错误', () => {
      const error = new BusinessError('业务操作失败');

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(CliError);
      expect(error).toBeInstanceOf(BusinessError);
      expect(error.name).toBe('BusinessError');
      expect(error.exitCode).toBe(ExitCode.BUSINESS_ERROR);
    });

    it('应该包含业务错误码', () => {
      const error = new BusinessError('资源不存在', {
        businessCode: 'RESOURCE_NOT_FOUND',
      });

      expect(error.getUserFriendlyMessage()).toContain('RESOURCE_NOT_FOUND');
    });

    it('应该为 not_found 提供恢复建议', () => {
      const error = new BusinessError('资源不存在', {
        businessCode: 'RESOURCE_NOT_FOUND',
      });

      expect(error.getRecoverySuggestion()).toContain('资源是否存在');
    });

    it('应该为 permission 错误提供恢复建议', () => {
      const error = new BusinessError('权限不足', {
        businessCode: 'PERMISSION_DENIED',
      });

      expect(error.getRecoverySuggestion()).toContain('权限');
    });

    it('应该为 invalid 错误提供恢复建议', () => {
      const error = new BusinessError('参数无效', {
        businessCode: 'INVALID_PARAMETER',
      });

      expect(error.getRecoverySuggestion()).toContain('参数');
    });

    it('应该为未知业务错误提供默认的错误消息', () => {
      const error = new BusinessError('业务错误', {});

      expect(error.getUserFriendlyMessage()).toBe('业务错误');
    });

    it('应该为未知业务错误提供默认的恢复建议', () => {
      const error = new BusinessError('业务错误', {});

      expect(error.getRecoverySuggestion()).toContain('--verbose');
    });
  });

  describe('ValidationError', () => {
    it('应该创建验证错误', () => {
      const error = new ValidationError('参数验证失败');

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(CliError);
      expect(error).toBeInstanceOf(ValidationError);
      expect(error.name).toBe('ValidationError');
      expect(error.exitCode).toBe(ExitCode.GENERAL_ERROR);
    });

    it('应该包含字段信息', () => {
      const error = new ValidationError('必填字段', {
        field: 'name',
      });

      expect(error.getUserFriendlyMessage()).toContain('name');
    });

    it('应该提供字段相关的恢复建议', () => {
      const error = new ValidationError('必填字段', {
        field: 'name',
      });

      expect(error.getRecoverySuggestion()).toContain('name');
      expect(error.getRecoverySuggestion()).toContain('--help');
    });

    it('应该为无字段的验证错误提供默认的错误消息', () => {
      const error = new ValidationError('验证失败', {});

      expect(error.getUserFriendlyMessage()).toBe('参数验证失败: 验证失败');
    });

    it('应该为无字段的验证错误提供默认的恢复建议', () => {
      const error = new ValidationError('验证失败', {});

      expect(error.getRecoverySuggestion()).toContain('--help');
    });
  });

  describe('类型守卫函数', () => {
    it('isCliError 应该正确判断 CLI 错误', () => {
      const cliError = new CliError('测试');
      const normalError = new Error('测试');

      expect(isCliError(cliError)).toBe(true);
      expect(isCliError(normalError)).toBe(false);
    });

    it('isAuthError 应该正确判断鉴权错误', () => {
      const authError = new AuthError(AuthErrorReason.INVALID_CREDENTIALS, '测试');
      const cliError = new CliError('测试');

      expect(isAuthError(authError)).toBe(true);
      expect(isAuthError(cliError)).toBe(false);
    });

    it('isNetworkError 应该正确判断网络错误', () => {
      const networkError = new NetworkError('测试');
      const cliError = new CliError('测试');

      expect(isNetworkError(networkError)).toBe(true);
      expect(isNetworkError(cliError)).toBe(false);
    });

    it('isBusinessError 应该正确判断业务错误', () => {
      const businessError = new BusinessError('测试');
      const cliError = new CliError('测试');

      expect(isBusinessError(businessError)).toBe(true);
      expect(isBusinessError(cliError)).toBe(false);
    });

    it('isValidationError 应该正确判断验证错误', () => {
      const validationError = new ValidationError('测试');
      const cliError = new CliError('测试');

      expect(isValidationError(validationError)).toBe(true);
      expect(isValidationError(cliError)).toBe(false);
    });
  });
});
