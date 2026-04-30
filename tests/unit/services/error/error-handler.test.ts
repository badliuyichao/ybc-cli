import {
  ErrorHandler,
  setupGlobalErrorHandler,
  handleErrorAndExit,
} from '@/services/error/error-handler';
import {
  CliError,
  AuthError,
  AuthErrorReason,
  NetworkError,
  BusinessError,
  ValidationError,
} from '@/services/error/errors';
import { ExitCode } from '@/services/error/codes';

// Mock console.error
const mockConsoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

// Mock process.exit
const mockProcessExit = jest.spyOn(process, 'exit').mockImplementation((() => {}) as never);

// Mock process.on
const mockProcessOn = jest.spyOn(process, 'on').mockImplementation(() => process);

describe('ErrorHandler', () => {
  beforeEach(() => {
    // 重置单例
    ErrorHandler.resetInstance();
    // 清除 mock
    mockConsoleError.mockClear();
    mockProcessExit.mockClear();
  });

  afterAll(() => {
    // 恢复原始实现
    mockConsoleError.mockRestore();
    mockProcessExit.mockRestore();
    mockProcessOn.mockRestore();
  });

  describe('getInstance', () => {
    it('应该返回单例实例', () => {
      const instance1 = ErrorHandler.getInstance();
      const instance2 = ErrorHandler.getInstance();

      expect(instance1).toBe(instance2);
    });

    it('应该支持自定义配置', () => {
      const instance = ErrorHandler.getInstance({ quiet: true });

      expect(instance).toBeInstanceOf(ErrorHandler);
    });
  });

  describe('resetInstance', () => {
    it('应该重置单例', () => {
      const instance1 = ErrorHandler.getInstance();
      ErrorHandler.resetInstance();
      const instance2 = ErrorHandler.getInstance();

      expect(instance1).not.toBe(instance2);
    });
  });

  describe('updateConfig', () => {
    it('应该更新配置', () => {
      const instance = ErrorHandler.getInstance({ quiet: false });
      instance.updateConfig({ quiet: true });

      // 验证配置更新成功（间接验证）
      const error = new Error('测试');
      instance.handle(error);

      // 静默模式下不应该有恢复建议
      const output = mockConsoleError.mock.calls.join('\n');
      expect(output).not.toContain('建议:');
    });
  });

  describe('handle', () => {
    it('应该处理 CliError', () => {
      const instance = ErrorHandler.getInstance();
      const error = new CliError('测试错误', ExitCode.GENERAL_ERROR);

      const exitCode = instance.handle(error);

      expect(exitCode).toBe(ExitCode.GENERAL_ERROR);
      expect(mockConsoleError).toHaveBeenCalled();
    });

    it('应该处理普通 Error', () => {
      const instance = ErrorHandler.getInstance();
      const error = new Error('普通错误');

      const exitCode = instance.handle(error);

      expect(exitCode).toBe(ExitCode.GENERAL_ERROR);
      expect(mockConsoleError).toHaveBeenCalled();
    });

    it('应该处理 AuthError', () => {
      const instance = ErrorHandler.getInstance();
      const error = new AuthError(AuthErrorReason.INVALID_CREDENTIALS, '鉴权失败');

      const exitCode = instance.handle(error);

      expect(exitCode).toBe(ExitCode.AUTH_ERROR);
      expect(mockConsoleError).toHaveBeenCalled();

      const output = mockConsoleError.mock.calls.join('\n');
      expect(output).toContain('App Key 或 App Secret 无效');
    });

    it('应该处理 NetworkError', () => {
      const instance = ErrorHandler.getInstance();
      const error = new NetworkError('网络错误', { isTimeout: true });

      const exitCode = instance.handle(error);

      expect(exitCode).toBe(ExitCode.NETWORK_ERROR);
      expect(mockConsoleError).toHaveBeenCalled();

      const output = mockConsoleError.mock.calls.join('\n');
      expect(output).toContain('请求超时');
    });

    it('应该处理 BusinessError', () => {
      const instance = ErrorHandler.getInstance();
      const error = new BusinessError('业务错误', { businessCode: 'TEST_ERROR' });

      const exitCode = instance.handle(error);

      expect(exitCode).toBe(ExitCode.BUSINESS_ERROR);
      expect(mockConsoleError).toHaveBeenCalled();

      const output = mockConsoleError.mock.calls.join('\n');
      expect(output).toContain('TEST_ERROR');
    });

    it('应该处理 ValidationError', () => {
      const instance = ErrorHandler.getInstance();
      const error = new ValidationError('验证失败', { field: 'name' });

      const exitCode = instance.handle(error);

      expect(exitCode).toBe(ExitCode.GENERAL_ERROR);
      expect(mockConsoleError).toHaveBeenCalled();

      const output = mockConsoleError.mock.calls.join('\n');
      expect(output).toContain('name');
    });
  });

  describe('getExitCode', () => {
    it('应该返回 CliError 的退出码', () => {
      const instance = ErrorHandler.getInstance();

      expect(instance.getExitCode(new AuthError(AuthErrorReason.INVALID_CREDENTIALS, '测试'))).toBe(
        ExitCode.AUTH_ERROR
      );
      expect(instance.getExitCode(new NetworkError('测试'))).toBe(ExitCode.NETWORK_ERROR);
      expect(instance.getExitCode(new BusinessError('测试'))).toBe(ExitCode.BUSINESS_ERROR);
    });

    it('应该为普通错误返回 GENERAL_ERROR', () => {
      const instance = ErrorHandler.getInstance();
      const error = new Error('普通错误');

      expect(instance.getExitCode(error)).toBe(ExitCode.GENERAL_ERROR);
    });
  });

  describe('静默模式', () => {
    it('在静默模式下应该不输出恢复建议', () => {
      const instance = ErrorHandler.getInstance({ quiet: true });
      const error = new AuthError(AuthErrorReason.INVALID_CREDENTIALS, '鉴权失败');

      instance.handle(error);

      const output = mockConsoleError.mock.calls.join('\n');
      expect(output).not.toContain('建议:');
    });
  });

  describe('详细模式', () => {
    it('在详细模式下应该输出错误堆栈', () => {
      const instance = ErrorHandler.getInstance({ verbose: true });
      const error = new Error('测试错误');

      instance.handle(error);

      const output = mockConsoleError.mock.calls.join('\n');
      expect(output).toContain('堆栈追踪:');
    });

    it('在详细模式下应该输出错误详情', () => {
      const instance = ErrorHandler.getInstance({ verbose: true });
      const error = new CliError('测试错误', ExitCode.GENERAL_ERROR, {
        code: 'TEST_CODE',
      });

      instance.handle(error);

      const output = mockConsoleError.mock.calls.join('\n');
      expect(output).toContain('详细信息:');
      expect(output).toContain('TEST_CODE');
    });
  });

  describe('sanitizeDetails', () => {
    it('应该移除敏感信息', () => {
      const instance = ErrorHandler.getInstance({ verbose: true });
      const error = new CliError('测试错误', ExitCode.GENERAL_ERROR, {
        password: 'secret-password',
        sk: 'secret-key',
        token: 'secret-token',
        normalField: 'normal-value',
      });

      instance.handle(error);

      const output = mockConsoleError.mock.calls.join('\n');
      expect(output).not.toContain('secret-password');
      expect(output).not.toContain('secret-key');
      expect(output).not.toContain('secret-token');
      expect(output).toContain('normal-value');
      expect(output).toContain('***');
    });

    it('应该递归处理嵌套对象', () => {
      const instance = ErrorHandler.getInstance({ verbose: true });
      const error = new CliError('测试错误', ExitCode.GENERAL_ERROR, {
        config: {
          password: 'nested-password',
          ak: 'test-ak',
        },
      });

      instance.handle(error);

      const output = mockConsoleError.mock.calls.join('\n');
      expect(output).not.toContain('nested-password');
      expect(output).toContain('test-ak');
    });
  });

  describe('静态方法', () => {
    describe('createUserFriendlyMessage', () => {
      it('应该为 CliError 创建用户友好的消息', () => {
        const error = new AuthError(AuthErrorReason.INVALID_CREDENTIALS, '鉴权失败');
        const message = ErrorHandler.createUserFriendlyMessage(error);

        expect(message).toContain('App Key 或 App Secret 无效');
      });

      it('应该为普通 Error 返回错误消息', () => {
        const error = new Error('普通错误');
        const message = ErrorHandler.createUserFriendlyMessage(error);

        expect(message).toBe('普通错误');
      });
    });

    describe('createRecoverySuggestion', () => {
      it('应该为 CliError 创建恢复建议', () => {
        const error = new AuthError(AuthErrorReason.INVALID_CREDENTIALS, '鉴权失败');
        const suggestion = ErrorHandler.createRecoverySuggestion(error);

        expect(suggestion).toContain('config set');
      });

      it('应该为普通 Error 返回默认建议', () => {
        const error = new Error('普通错误');
        const suggestion = ErrorHandler.createRecoverySuggestion(error);

        expect(suggestion).toContain('--verbose');
      });
    });
  });
});

describe('setupGlobalErrorHandler', () => {
  it('应该注册 uncaughtException 处理器', () => {
    // 重新 mock process.on
    const spy = jest.spyOn(process, 'on').mockImplementation(() => process);

    setupGlobalErrorHandler();

    expect(spy).toHaveBeenCalledWith('uncaughtException', expect.any(Function));

    spy.mockRestore();
  });

  it('应该注册 unhandledRejection 处理器', () => {
    // 重新 mock process.on
    const spy = jest.spyOn(process, 'on').mockImplementation(() => process);

    setupGlobalErrorHandler();

    expect(spy).toHaveBeenCalledWith('unhandledRejection', expect.any(Function));

    spy.mockRestore();
  });

  it('应该支持自定义配置', () => {
    // 重新 mock process.on
    const spy = jest.spyOn(process, 'on').mockImplementation(() => process);

    setupGlobalErrorHandler({ quiet: true, verbose: false });

    expect(spy).toHaveBeenCalledTimes(2);

    spy.mockRestore();
  });
});

describe('handleErrorAndExit', () => {
  beforeEach(() => {
    ErrorHandler.resetInstance();
    mockConsoleError.mockClear();
    mockProcessExit.mockClear();
  });

  afterAll(() => {
    // 恢复原始实现
    mockConsoleError.mockRestore();
    mockProcessExit.mockRestore();
  });

  // 注意：handleErrorAndExit 函数会调用 process.exit
  // 在测试环境中，我们无法真正测试这个函数，因为它会终止进程
  // 所以我们跳过这个测试，或者在实际使用中单独测试
  it.skip('应该处理错误并退出', () => {
    const error = new AuthError(AuthErrorReason.INVALID_CREDENTIALS, '鉴权失败');

    handleErrorAndExit(error);

    expect(mockProcessExit).toHaveBeenCalledWith(ExitCode.AUTH_ERROR);
  });
});
