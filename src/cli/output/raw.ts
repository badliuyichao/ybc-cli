/**
 * Raw 格式化器
 *
 * 输出服务端原始 JSON，不做任何处理
 */

import { OutputFormatter } from './formatter';

/**
 * Raw 格式化器类
 *
 * 特性：
 * - 输出原始 JSON（无缩进）
 * - 保持数据原始结构
 * - 适用于管道传输和程序处理
 */
export class RawFormatter implements OutputFormatter {
  /**
   * 格式化数据为原始 JSON 字符串
   * @param data - 要格式化的数据（可以是任何类型）
   * @returns 格式化后的 JSON 字符串（无缩进）
   */
  format(data: unknown): string {
    return JSON.stringify(data);
  }
}
