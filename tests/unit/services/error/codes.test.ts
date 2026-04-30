import { ExitCode, ExitCodeDescriptions, getExitCodeDescription } from '@/services/error/codes';

describe('ExitCode', () => {
  describe('枚举值', () => {
    it('应该定义 SUCCESS 为 0', () => {
      expect(ExitCode.SUCCESS).toBe(0);
    });

    it('应该定义 GENERAL_ERROR 为 1', () => {
      expect(ExitCode.GENERAL_ERROR).toBe(1);
    });

    it('应该定义 BUSINESS_ERROR 为 4', () => {
      expect(ExitCode.BUSINESS_ERROR).toBe(4);
    });

    it('应该定义 NETWORK_ERROR 为 5', () => {
      expect(ExitCode.NETWORK_ERROR).toBe(5);
    });

    it('应该定义 AUTH_ERROR 为 6', () => {
      expect(ExitCode.AUTH_ERROR).toBe(6);
    });
  });

  describe('ExitCodeDescriptions', () => {
    it('应该为所有退出码提供描述', () => {
      expect(ExitCodeDescriptions[ExitCode.SUCCESS]).toBe('操作成功');
      expect(ExitCodeDescriptions[ExitCode.GENERAL_ERROR]).toBe('通用错误');
      expect(ExitCodeDescriptions[ExitCode.BUSINESS_ERROR]).toBe('业务错误');
      expect(ExitCodeDescriptions[ExitCode.NETWORK_ERROR]).toBe('网络错误');
      expect(ExitCodeDescriptions[ExitCode.AUTH_ERROR]).toBe('鉴权错误');
    });

    it('应该包含所有退出码', () => {
      const exitCodes = Object.values(ExitCode).filter((v) => typeof v === 'number');
      const descriptions = Object.keys(ExitCodeDescriptions);

      expect(descriptions.length).toBe(exitCodes.length);
    });
  });

  describe('getExitCodeDescription', () => {
    it('应该返回正确的退出码描述', () => {
      expect(getExitCodeDescription(ExitCode.SUCCESS)).toBe('操作成功');
      expect(getExitCodeDescription(ExitCode.GENERAL_ERROR)).toBe('通用错误');
      expect(getExitCodeDescription(ExitCode.BUSINESS_ERROR)).toBe('业务错误');
      expect(getExitCodeDescription(ExitCode.NETWORK_ERROR)).toBe('网络错误');
      expect(getExitCodeDescription(ExitCode.AUTH_ERROR)).toBe('鉴权错误');
    });

    it('应该为未知退出码返回 "未知错误"', () => {
      // 使用一个不存在的退出码
      expect(getExitCodeDescription(999 as ExitCode)).toBe('未知错误');
    });
  });
});
