/**
 * Logger 单元测试
 */

import { Logger, createLogger } from '../../../../src/services/logger/logger';
import { LogLevel, LoggerConfig } from '../../../../src/types/http';

describe('Logger', () => {
  let consoleLogSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    // Mock console 方法
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  describe('构造函数', () => {
    it('应该使用默认配置创建 Logger', () => {
      const logger = new Logger();

      expect(logger).toBeInstanceOf(Logger);
    });

    it('应该使用自定义配置创建 Logger', () => {
      const config: LoggerConfig = {
        verbose: true,
        colorize: false,
        level: LogLevel.DEBUG,
        prefix: 'test',
      };

      const logger = new Logger(config);

      expect(logger).toBeInstanceOf(Logger);
    });

    it('应该从环境变量读取 verbose 配置', () => {
      process.env.YBC_VERBOSE = 'true';

      const logger = new Logger();

      // verbose 模式下应该输出 debug 日志
      logger.debug('test message');

      expect(consoleLogSpy).toHaveBeenCalled();

      delete process.env.YBC_VERBOSE;
    });
  });

  describe('日志级别', () => {
    it('应该输出 debug 日志（verbose 模式）', () => {
      const logger = new Logger({ verbose: true, colorize: false });

      logger.debug('test debug message');

      expect(consoleLogSpy).toHaveBeenCalled();
      const output = consoleLogSpy.mock.calls[0][0];
      expect(output).toContain('DEBUG');
      expect(output).toContain('test debug message');
    });

    it('不应该输出 debug 日志（非 verbose 模式）', () => {
      const logger = new Logger({ verbose: false, level: LogLevel.INFO });

      logger.debug('test debug message');

      expect(consoleLogSpy).not.toHaveBeenCalled();
    });

    it('应该输出 info 日志', () => {
      const logger = new Logger({ colorize: false });

      logger.info('test info message');

      expect(consoleLogSpy).toHaveBeenCalled();
      const output = consoleLogSpy.mock.calls[0][0];
      expect(output).toContain('INFO');
      expect(output).toContain('test info message');
    });

    it('应该输出 warn 日志', () => {
      const logger = new Logger({ colorize: false });

      logger.warn('test warn message');

      expect(consoleLogSpy).toHaveBeenCalled();
      const output = consoleLogSpy.mock.calls[0][0];
      expect(output).toContain('WARN');
      expect(output).toContain('test warn message');
    });

    it('应该输出 error 日志', () => {
      const logger = new Logger({ colorize: false });

      logger.error('test error message');

      expect(consoleErrorSpy).toHaveBeenCalled();
      const output = consoleErrorSpy.mock.calls[0][0];
      expect(output).toContain('ERROR');
      expect(output).toContain('test error message');
    });
  });

  describe('额外参数', () => {
    it('应该输出额外参数', () => {
      const logger = new Logger({ colorize: false });

      logger.info('test message', { key: 'value' });

      expect(consoleLogSpy).toHaveBeenCalled();
      expect(consoleLogSpy.mock.calls[0][1]).toEqual({ key: 'value' });
    });

    it('应该输出多个额外参数', () => {
      const logger = new Logger({ colorize: false });

      logger.info('test message', 'param1', 'param2');

      expect(consoleLogSpy).toHaveBeenCalled();
      expect(consoleLogSpy.mock.calls[0][1]).toBe('param1');
      expect(consoleLogSpy.mock.calls[0][2]).toBe('param2');
    });
  });

  describe('前缀', () => {
    it('应该输出带前缀的日志', () => {
      const logger = new Logger({ prefix: 'TestPrefix', colorize: false });

      logger.info('test message');

      expect(consoleLogSpy).toHaveBeenCalled();
      const output = consoleLogSpy.mock.calls[0][0];
      expect(output).toContain('[TestPrefix]');
      expect(output).toContain('test message');
    });

    it('应该创建子 Logger 并叠加前缀', () => {
      const parentLogger = new Logger({ prefix: 'Parent', colorize: false });
      const childLogger = parentLogger.child('Child');

      childLogger.info('test message');

      expect(consoleLogSpy).toHaveBeenCalled();
      const output = consoleLogSpy.mock.calls[0][0];
      expect(output).toContain('[Parent:Child]');
      expect(output).toContain('test message');
    });
  });

  describe('颜色化', () => {
    it('应该在启用颜色时添加颜色代码', () => {
      const logger = new Logger({ colorize: true });

      logger.info('test message');

      expect(consoleLogSpy).toHaveBeenCalled();
      const output = consoleLogSpy.mock.calls[0][0];
      expect(output).toContain('\x1b['); // ANSI 颜色代码
    });

    it('应该在禁用颜色时不添加颜色代码', () => {
      const logger = new Logger({ colorize: false });

      logger.info('test message');

      expect(consoleLogSpy).toHaveBeenCalled();
      const output = consoleLogSpy.mock.calls[0][0];
      expect(output).not.toContain('\x1b[');
    });
  });

  describe('日志级别过滤', () => {
    it('应该只输出指定级别及以上级别的日志', () => {
      const logger = new Logger({ level: LogLevel.WARN, colorize: false });

      logger.debug('debug message');
      logger.info('info message');
      logger.warn('warn message');
      logger.error('error message');

      expect(consoleLogSpy).toHaveBeenCalledTimes(1); // warn
      expect(consoleErrorSpy).toHaveBeenCalledTimes(1); // error
    });
  });

  describe('createLogger 工厂函数', () => {
    it('应该创建 Logger 实例', () => {
      const logger = createLogger();

      expect(logger).toBeInstanceOf(Logger);
    });

    it('应该使用配置创建 Logger 实例', () => {
      const logger = createLogger({ verbose: true });

      expect(logger).toBeInstanceOf(Logger);
    });
  });
});