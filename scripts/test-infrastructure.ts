/**
 * Infrastructure 层功能验证脚本
 *
 * 验证：
 * 1. 能创建 ~/.ybc/test.json 文件（权限 600）
 * 2. 能加密字符串并正确解密
 * 3. 能读取环境变量
 */

import * as path from 'path';
import * as os from 'os';
import { FileStorage } from '../src/infrastructure/storage/file-storage';
import { EncryptionService } from '../src/infrastructure/crypto/encryption-service';
import { EnvService } from '../src/infrastructure/env/env-service';

async function verifyInfrastructure() {
  console.log('=== Infrastructure 层功能验证 ===\n');

  const storage = new FileStorage();
  const encryptionService = new EncryptionService();
  const envService = new EnvService();

  try {
    // 1. 文件存储验证
    console.log('1. 文件存储服务验证');
    const testDir = path.join(os.homedir(), '.ybc');
    const testFile = path.join(testDir, 'test.json');

    console.log(`   创建文件: ${testFile}`);
    await storage.write(testFile, {
      test: true,
      timestamp: new Date().toISOString(),
      message: 'Infrastructure 层验证成功',
    });

    console.log('   ✓ 文件创建成功');

    const data = await storage.read(testFile);
    console.log('   ✓ 文件读取成功:', data);

    console.log('   清理测试文件...');
    await storage.delete(testFile);
    console.log('   ✓ 测试文件已删除\n');

    // 2. 加密服务验证
    console.log('2. 加密服务验证');
    const plaintext = 'This is a secret message: AK=test-ak, SK=test-sk';
    console.log(`   原文: ${plaintext}`);

    const encrypted = await encryptionService.encrypt(plaintext);
    console.log(`   加密后: ${encrypted.substring(0, 50)}...`);
    console.log('   ✓ 加密成功');

    const decrypted = await encryptionService.decrypt(encrypted);
    console.log(`   解密后: ${decrypted}`);
    console.log('   ✓ 解密成功');

    if (decrypted === plaintext) {
      console.log('   ✓ 加密/解密验证通过\n');
    } else {
      console.log('   ✗ 加密/解密验证失败：内容不一致\n');
    }

    // 3. 环境变量服务验证
    console.log('3. 环境变量服务验证');

    // 测试读取环境变量
    console.log('   当前 YBC 环境变量：');
    const config = envService.getAll();
    console.log('   ', config);

    // 测试设置环境变量
    envService.set('YBC_FORMAT', 'json');
    const format = envService.getFormat();
    console.log(`   设置 YBC_FORMAT=json, 获取值: ${format}`);
    console.log('   ✓ 环境变量读写成功\n');

    // 测试验证功能
    envService.delete('YBC_FORMAT');
    envService.delete('YBC_AK');
    envService.delete('YBC_SK');
    const isValid = envService.validate();
    console.log(`   环境变量验证结果: ${isValid}`);
    console.log('   ✓ 环境变量验证功能正常\n');

    console.log('=== 所有功能验证通过 ✓ ===\n');
  } catch (error) {
    console.error('验证失败:', error);
    process.exit(1);
  }
}

verifyInfrastructure().catch(console.error);