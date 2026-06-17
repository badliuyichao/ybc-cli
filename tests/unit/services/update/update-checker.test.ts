/**
 * UpdateChecker 单元测试（CR-044）
 *
 * 测试 UpdateChecker 的核心逻辑：
 * 1. 24 小时缓存机制
 * 2. semver 版本比较
 * 3. 启动时异步检查（不阻塞）
 * 4. 网络错误静默失败
 * 5. silent 模式不打印提示
 * 6. 显示更新提示信息
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import { UpdateChecker } from '@/services/update/update-checker';

describe('UpdateChecker (CR-044 单元测试)', () => {
  let mockAxios: MockAdapter;
  let tempCacheDir: string;
  let originalCacheFile: string;
  let consoleLogSpy: jest.SpyInstance;

  beforeEach(() => {
    mockAxios = new MockAdapter(axios);

    // 清理 ~/.ybc/update-check.json（避免上次测试残留导致缓存命中）
    const homeCache = path.join(os.homedir(), '.ybc', 'update-check.json');
    try {
      if (fs.existsSync(homeCache)) {
        fs.rmSync(homeCache);
      }
    } catch {
      // 忽略
    }

    tempCacheDir = path.join(os.tmpdir(), 'ybc-update-test-', Date.now().toString());
    fs.mkdirSync(tempCacheDir, { recursive: true });

    originalCacheFile = path.join(os.homedir(), '.ybc', 'update-check.json');

    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
  });

  afterEach(() => {
    mockAxios.restore();
    consoleLogSpy.mockRestore();

    // 清理临时缓存
    try {
      fs.rmSync(tempCacheDir, { recursive: true, force: true });
    } catch {
      // 忽略
    }

    // 清理默认缓存
    try {
      if (fs.existsSync(originalCacheFile)) {
        fs.rmSync(originalCacheFile);
      }
    } catch {
      // 忽略
    }
  });

  // ============================================================
  // 1. semver 版本比较
  // ============================================================
  describe('版本号比较 (isNewerVersion)', () => {
    it('应该把更高主版本识别为新版本', () => {
      // 通过 checkForUpdates 间接测试（isNewerVersion 是 private）
      // mock npm 返回 1.0.0，当前是 0.1.6
      mockAxios.onGet(/registry\.npmjs\.org/).reply(200, { version: '1.0.0' });

      return UpdateChecker.checkForUpdates(false).then(() => {
        // 应该打印更新提示
        const updateLogs = consoleLogSpy.mock.calls
          .map((c) => String(c[0]))
          .filter((m) => m.includes('发现新版本'));
        expect(updateLogs.length).toBeGreaterThan(0);
      });
    });

    it('应该把相同版本不识别为新版本', () => {
      // 用真实 package.json 当前版本（从项目根目录读，4 层 .. 回到根）
      const currentVersion = JSON.parse(
        fs.readFileSync(path.join(__dirname, '../../../../package.json'), 'utf-8')
      ).version;

      mockAxios.onGet(/registry\.npmjs\.org/).reply(200, { version: currentVersion });

      return UpdateChecker.checkForUpdates(false).then(() => {
        const updateLogs = consoleLogSpy.mock.calls
          .map((c) => String(c[0]))
          .filter((m) => m.includes('发现新版本'));
        expect(updateLogs.length).toBe(0);
      });
    });

    it('应该把更低主版本不识别为新版本', () => {
      mockAxios.onGet(/registry\.npmjs\.org/).reply(200, { version: '0.0.1' });

      return UpdateChecker.checkForUpdates(false).then(() => {
        const updateLogs = consoleLogSpy.mock.calls
          .map((c) => String(c[0]))
          .filter((m) => m.includes('发现新版本'));
        expect(updateLogs.length).toBe(0);
      });
    });

    it('应该正确处理次版本号比较', () => {
      // 当前 0.1.6，mock 返回 0.2.0 → 应提示
      mockAxios.onGet(/registry\.npmjs\.org/).reply(200, { version: '0.2.0' });

      return UpdateChecker.checkForUpdates(false).then(() => {
        const updateLogs = consoleLogSpy.mock.calls
          .map((c) => String(c[0]))
          .filter((m) => m.includes('发现新版本'));
        expect(updateLogs.length).toBeGreaterThan(0);
      });
    });

    it('应该正确处理补丁版本比较', () => {
      // 当前 0.1.6，mock 返回 0.1.7 → 应提示
      mockAxios.onGet(/registry\.npmjs\.org/).reply(200, { version: '0.1.7' });

      return UpdateChecker.checkForUpdates(false).then(() => {
        const updateLogs = consoleLogSpy.mock.calls
          .map((c) => String(c[0]))
          .filter((m) => m.includes('发现新版本'));
        expect(updateLogs.length).toBeGreaterThan(0);
      });
    });
  });

  // ============================================================
  // 2. silent 模式
  // ============================================================
  describe('silent 模式', () => {
    it('silent=true 时即使有新版本也不打印提示', () => {
      mockAxios.onGet(/registry\.npmjs\.org/).reply(200, { version: '99.0.0' });

      return UpdateChecker.checkForUpdates(true).then(() => {
        const updateLogs = consoleLogSpy.mock.calls
          .map((c) => String(c[0]))
          .filter((m) => m.includes('发现新版本'));
        expect(updateLogs.length).toBe(0);
      });
    });

    it('silent=false（默认）时新版本会打印提示', () => {
      mockAxios.onGet(/registry\.npmjs\.org/).reply(200, { version: '99.0.0' });

      return UpdateChecker.checkForUpdates(false).then(() => {
        const updateLogs = consoleLogSpy.mock.calls
          .map((c) => String(c[0]))
          .filter((m) => m.includes('发现新版本'));
        expect(updateLogs.length).toBeGreaterThan(0);
      });
    });
  });

  // ============================================================
  // 3. 24 小时缓存机制
  // ============================================================
  describe('24 小时缓存机制', () => {
    it('缓存存在且 24h 内 → 不发起 npm 请求', async () => {
      // 写入"刚刚检查过"的缓存
      const cacheFile = path.join(os.homedir(), '.ybc', 'update-check.json');
      const cacheDir = path.dirname(cacheFile);
      if (!fs.existsSync(cacheDir)) {
        fs.mkdirSync(cacheDir, { recursive: true });
      }
      fs.writeFileSync(
        cacheFile,
        JSON.stringify({ lastCheck: Date.now() - 1000 * 60 * 60 }), // 1 小时前
        'utf-8'
      );

      // 不 mock npm 请求 → 如果真发请求会因 axios 真实调用失败
      // 检查 axios 没被调用
      let axiosCalled = false;
      mockAxios.onGet(/registry\.npmjs\.org/).reply(() => {
        axiosCalled = true;
        return [200, { version: '99.0.0' }];
      });

      await UpdateChecker.checkForUpdates(false);

      expect(axiosCalled).toBe(false);
    });

    it('缓存不存在 → 发起 npm 请求', async () => {
      // 确保缓存不存在
      const cacheFile = path.join(os.homedir(), '.ybc', 'update-check.json');
      try {
        if (fs.existsSync(cacheFile)) {
          fs.rmSync(cacheFile);
        }
      } catch {
        // 忽略
      }

      let axiosCalled = false;
      mockAxios.onGet(/registry\.npmjs\.org/).reply(() => {
        axiosCalled = true;
        return [200, { version: '0.0.0' }]; // 返回更低版本，不提示
      });

      await UpdateChecker.checkForUpdates(false);

      expect(axiosCalled).toBe(true);
    });

    it('缓存超过 24 小时 → 重新检查', async () => {
      const cacheFile = path.join(os.homedir(), '.ybc', 'update-check.json');
      const cacheDir = path.dirname(cacheFile);
      if (!fs.existsSync(cacheDir)) {
        fs.mkdirSync(cacheDir, { recursive: true });
      }
      // 写入 25 小时前的缓存
      fs.writeFileSync(
        cacheFile,
        JSON.stringify({ lastCheck: Date.now() - 25 * 60 * 60 * 1000 }),
        'utf-8'
      );

      let axiosCalled = false;
      mockAxios.onGet(/registry\.npmjs\.org/).reply(() => {
        axiosCalled = true;
        return [200, { version: '0.0.0' }];
      });

      await UpdateChecker.checkForUpdates(false);

      expect(axiosCalled).toBe(true);
    });

    it('应该把检查时间写入缓存', async () => {
      const cacheFile = path.join(os.homedir(), '.ybc', 'update-check.json');
      try {
        if (fs.existsSync(cacheFile)) {
          fs.rmSync(cacheFile);
        }
      } catch {
        // 忽略
      }

      mockAxios.onGet(/registry\.npmjs\.org/).reply(200, { version: '0.0.0' });

      const before = Date.now();
      await UpdateChecker.checkForUpdates(false);
      const after = Date.now();

      // 应该写入缓存
      expect(fs.existsSync(cacheFile)).toBe(true);
      const cache = JSON.parse(fs.readFileSync(cacheFile, 'utf-8'));
      expect(cache.lastCheck).toBeGreaterThanOrEqual(before);
      expect(cache.lastCheck).toBeLessThanOrEqual(after);
    });
  });

  // ============================================================
  // 4. 错误处理（静默失败）
  // ============================================================
  describe('错误处理（静默失败）', () => {
    it('npm 网络错误时应静默失败', async () => {
      mockAxios.onGet(/registry\.npmjs\.org/).networkError();

      // 不应抛错
      await expect(UpdateChecker.checkForUpdates(false)).resolves.toBeUndefined();
    });

    it('npm 超时时静默失败', async () => {
      mockAxios.onGet(/registry\.npmjs\.org/).timeout();

      await expect(UpdateChecker.checkForUpdates(false)).resolves.toBeUndefined();
    });

    it('npm 返回 5xx 时静默失败', async () => {
      mockAxios.onGet(/registry\.npmjs\.org/).reply(503, {});

      await expect(UpdateChecker.checkForUpdates(false)).resolves.toBeUndefined();
    });

    it('npm 返回空 version 时静默处理（不崩溃）', async () => {
      mockAxios.onGet(/registry\.npmjs\.org/).reply(200, {});

      await expect(UpdateChecker.checkForUpdates(false)).resolves.toBeUndefined();
    });

    it('npm 返回非 JSON 响应时不崩溃', async () => {
      mockAxios.onGet(/registry\.npmjs\.org/).reply(200, 'not json');

      await expect(UpdateChecker.checkForUpdates(false)).resolves.toBeUndefined();
    });
  });

  // ============================================================
  // 5. 边界情况
  // ============================================================
  describe('边界情况', () => {
    it('应该能处理 npm 响应中 version 字段为空字符串', async () => {
      mockAxios.onGet(/registry\.npmjs\.org/).reply(200, { version: '' });

      await expect(UpdateChecker.checkForUpdates(false)).resolves.toBeUndefined();
    });

    it('应该能处理 npm 响应中 version 为非 semver 字符串', async () => {
      mockAxios.onGet(/registry\.npmjs\.org/).reply(200, { version: 'not-a-version' });

      // 不崩溃即可（后续比较可能 NaN，但 try/catch 兜底）
      await expect(UpdateChecker.checkForUpdates(false)).resolves.toBeUndefined();
    });

    it('默认 silent 参数应正常工作', async () => {
      mockAxios.onGet(/registry\.npmjs\.org/).reply(200, { version: '0.0.0' });

      // 不传 silent → 默认 false
      await expect(UpdateChecker.checkForUpdates()).resolves.toBeUndefined();
    });
  });
});