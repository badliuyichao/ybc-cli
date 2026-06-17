import axios from 'axios';
import chalk from 'chalk';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

/**
 * 版本更新检查器
 *
 * 启动时异步检查 npm 上的最新版本，发现新版本时提示用户更新。
 * 使用缓存机制避免频繁请求 npm registry。
 */
export class UpdateChecker {
  private static readonly NPM_REGISTRY = 'https://registry.npmjs.org';
  private static readonly PACKAGE_NAME = '@liuychk/ybc';
  private static readonly CACHE_DIR = path.join(os.homedir(), '.ybc');
  private static readonly CACHE_FILE = path.join(UpdateChecker.CACHE_DIR, 'update-check.json');
  private static readonly CHECK_INTERVAL = 24 * 60 * 60 * 1000; // 24小时

  /**
   * 异步检查更新（不阻塞 CLI 启动）
   */
  static async checkForUpdates(silent: boolean = false): Promise<void> {
    try {
      // 检查缓存，避免频繁请求
      if (this.isCheckCacheValid()) {
        return;
      }

      const latestVersion = await this.getLatestVersion();
      if (latestVersion && this.isNewerVersion(latestVersion)) {
        if (!silent) {
          this.showUpdateMessage(latestVersion);
        }
      }

      // 更新缓存
      this.updateCheckCache();
    } catch {
      // 静默失败，不影响 CLI 使用
    }
  }

  /**
   * 获取 npm 上的最新版本号
   */
  private static async getLatestVersion(): Promise<string | null> {
    const response = await axios.get<{ version?: string }>(
      `${this.NPM_REGISTRY}/${this.PACKAGE_NAME}/latest`,
      {
        timeout: 3000,
      }
    );
    return response.data?.version || null;
  }

  /**
   * 比较版本号，判断是否有更新
   */
  private static isNewerVersion(latest: string): boolean {
    const current = this.getCurrentVersion();
    const latestParts = latest.split('.').map(Number);
    const currentParts = current.split('.').map(Number);

    for (let i = 0; i < 3; i++) {
      const latestPart = latestParts[i] || 0;
      const currentPart = currentParts[i] || 0;
      if (latestPart > currentPart) return true;
      if (latestPart < currentPart) return false;
    }
    return false;
  }

  /**
   * 获取当前版本号
   */
  private static getCurrentVersion(): string {
    try {
      const packageJsonPath = path.join(__dirname, '../../../package.json');
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8')) as {
        version?: string;
      };
      return packageJson.version || '0.0.0';
    } catch {
      return '0.0.0';
    }
  }

  /**
   * 显示更新提示
   */
  private static showUpdateMessage(latestVersion: string): void {
    const currentVersion = this.getCurrentVersion();
    console.log(chalk.yellow(`\n💡 发现新版本: ${latestVersion} (当前: ${currentVersion})`));
    console.log(chalk.dim('   更新命令: npm install -g @liuychk/ybc@latest\n'));
  }

  /**
   * 检查缓存是否有效（24小时内只检查一次）
   */
  private static isCheckCacheValid(): boolean {
    try {
      if (!fs.existsSync(this.CACHE_FILE)) {
        return false;
      }

      const cacheData = JSON.parse(fs.readFileSync(this.CACHE_FILE, 'utf-8')) as {
        lastCheck?: number;
      };
      const lastCheck = cacheData.lastCheck || 0;
      const now = Date.now();

      return now - lastCheck < this.CHECK_INTERVAL;
    } catch {
      return false;
    }
  }

  /**
   * 更新检查缓存
   */
  private static updateCheckCache(): void {
    try {
      // 确保目录存在
      if (!fs.existsSync(this.CACHE_DIR)) {
        fs.mkdirSync(this.CACHE_DIR, { recursive: true });
      }

      const cacheData = {
        lastCheck: Date.now(),
      };

      fs.writeFileSync(this.CACHE_FILE, JSON.stringify(cacheData, null, 2), 'utf-8');
    } catch {
      // 缓存写入失败不影响使用
    }
  }
}
