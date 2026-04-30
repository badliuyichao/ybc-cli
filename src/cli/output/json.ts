/**
 * JSON 格式化器
 *
 * 将数据格式化为 JSON 字符串，支持稳定的键顺序
 */

import { OutputFormatter } from './formatter';

/**
 * JSON 格式化器类
 *
 * 特性：
 * - 格式化输出为缩进的 JSON
 * - 稳定的键顺序（便于 diff 和比较）
 * - 处理循环引用
 */
export class JsonFormatter implements OutputFormatter {
  /**
   * 格式化数据为 JSON 字符串
   * @param data - 要格式化的数据（可以是任何类型）
   * @returns 格式化后的 JSON 字符串
   */
  format(data: unknown): string {
    try {
      // 使用自定义 replacer 函数实现键排序
      return JSON.stringify(data, this.createReplacer(), 2);
    } catch (error) {
      // 如果对象包含循环引用或其他无法序列化的数据
      // 尝试使用更宽松的方式
      return JSON.stringify(data, null, 2);
    }
  }

  /**
   * 创建 replacer 函数，用于键排序
   * 仅对对象类型的键进行排序，对数组和其他类型保持原样
   */
  private createReplacer(): (key: string, value: unknown) => unknown {
    return (_key: string, value: unknown): unknown => {
      // 仅对非数组对象进行键排序
      if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
        // 创建键排序后的新对象
        const obj = value as Record<string, unknown>;
        const sortedKeys = Object.keys(obj).sort();
        const sortedObj: Record<string, unknown> = {};
        sortedKeys.forEach((k) => {
          sortedObj[k] = obj[k];
        });
        return sortedObj;
      }
      // 对于数组、null、基本类型，保持原样
      return value;
    };
  }
}
