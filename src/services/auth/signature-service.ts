/**
 * 签名计算服务
 *
 * 实现用友 BIP API 的 HmacSHA256 签名算法
 *
 * 签名算法流程：
 * 1. 构建参数对象（appKey、timestamp）
 * 2. 按参数名字母序排序
 * 3. 拼接参数名和值（无分隔符）
 * 4. 使用 HmacSHA256 加密（密钥为 appSecret）
 * 5. Base64 编码
 * 6. URLEncode 编码
 *
 * 示例：
 * ```
 * const service = new SignatureService();
 * const signature = service.calculateSignature({
 *   appKey: '41832a3d2df94989b500da6a22268747',
 *   timestamp: 1568098531823,
 *   appSecret: 'your-secret'
 * });
 * ```
 */

import * as crypto from 'crypto';
import { SignatureParams } from '../../types/auth';

export class SignatureService {
  /**
   * 计算签名
   *
   * 签名算法：URLEncode(Base64(HmacSHA256(sortedParams, appSecret)))
   *
   * @param params 签名参数（appKey、timestamp、appSecret）
   * @returns 签名值（URL编码的Base64字符串）
   *
   * @example
   * ```typescript
   * const service = new SignatureService();
   * const signature = service.calculateSignature({
   *   appKey: '41832a3d2df94989b500da6a22268747',
   *   timestamp: 1568098531823,
   *   appSecret: 'your-app-secret'
   * });
   * console.log(signature);
   * // 输出: URLEncode(Base64(HmacSHA256结果))
   * ```
   */
  calculateSignature(params: SignatureParams): string {
    // 步骤 1: 构建参数对象（不包含 appSecret，appSecret 用于签名密钥）
    const paramMap: Record<string, string> = {
      appKey: params.appKey,
      timestamp: params.timestamp.toString(),
    };

    // 步骤 2: 按参数名字母序排序
    // 结果: ['appKey', 'timestamp']
    const sortedKeys = Object.keys(paramMap).sort();

    // 步骤 3: 拼接参数名和值（无分隔符）
    // 结果: "appKey{value}timestamp{value}"
    let signString = '';
    for (const key of sortedKeys) {
      signString += key + paramMap[key];
    }

    // 步骤 4: 使用 HmacSHA256 加密（密钥为 appSecret）
    // 注意：使用 UTF-8 编码确保一致性
    const hmac = crypto.createHmac('sha256', params.appSecret);
    hmac.update(signString, 'utf8');
    const signatureBinary = hmac.digest(); // 返回 Buffer

    // 步骤 5: Base64 编码（对二进制签名结果）
    // 注意：不进行 URLEncode，让 axios 的 params 自动处理编码
    // 否则会导致双重编码问题
    const signatureBase64 = signatureBinary.toString('base64');

    return signatureBase64;
  }

  /**
   * 生成时间戳（毫秒级）
   *
   * @returns 当前时间的毫秒级时间戳（13位数字）
   *
   * @example
   * ```typescript
   * const service = new SignatureService();
   * const timestamp = service.generateTimestamp();
   * console.log(timestamp); // 1568098531823
   * ```
   */
  generateTimestamp(): number {
    // JavaScript Date.now() 返回自 1970-01-01 00:00:00 UTC 以来的毫秒数
    return Date.now();
  }

  /**
   * 验证签名计算是否正确（用于测试）
   *
   * @param params 签名参数
   * @param expectedSignature 期望的签名值
   * @returns 如果计算出的签名与期望值匹配则返回 true，否则返回 false
   *
   * @example
   * ```typescript
   * const service = new SignatureService();
   * const params = {
   *   appKey: '41832a3d2df94989b500da6a22268747',
   *   timestamp: 1568098531823,
   *   appSecret: 'your-app-secret'
   * };
   * const signature = service.calculateSignature(params);
   * const isValid = service.verifySignature(params, signature);
   * console.log(isValid); // true
   * ```
   */
  verifySignature(params: SignatureParams, expectedSignature: string): boolean {
    const calculated = this.calculateSignature(params);
    return calculated === expectedSignature;
  }
}