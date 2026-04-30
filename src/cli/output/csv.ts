/**
 * CSV 格式化器
 *
 * 将数据格式化为 CSV 格式，支持 Excel 兼容
 */

import { OutputFormatter } from './formatter';

/**
 * CSV 格式化器类
 *
 * 特性：
 * - 支持对象数组转 CSV
 * - 处理特殊字符（引号、逗号、换行）
 * - Excel 兼容（UTF-8 BOM）
 */
export class CsvFormatter implements OutputFormatter {
  /**
   * 格式化数据为 CSV 字符串
   * @param data - 要格式化的数据（可以是任何类型）
   * @returns 格式化后的 CSV 字符串
   */
  format(data: unknown): string {
    // 处理空数据
    if (!data) {
      return '';
    }

    // 处理非数组数据（单个对象）
    if (!Array.isArray(data)) {
      if (typeof data === 'object') {
        // 将单个对象转换为数组处理
        return this.format([data]);
      }
      // 其他类型直接返回字符串
      return String(data);
    }

    // 处理空数组
    if (data.length === 0) {
      return '';
    }

    // 处理对象数组
    if (typeof data[0] === 'object' && data[0] !== null) {
      return this.formatObjectArray(data as Record<string, unknown>[]);
    }

    // 处理基本类型数组
    return this.formatPrimitiveArray(data as unknown[]);
  }

  /**
   * 格式化对象数组为 CSV
   */
  private formatObjectArray(arr: Record<string, unknown>[]): string {
    // 获取所有字段名（从第一个对象）
    const headers = this.extractHeaders(arr);

    // 生成标题行
    const headerRow = headers.map((h) => this.escapeCSVField(h)).join(',');

    // 生成数据行
    const dataRows = arr.map((item) => {
      return headers
        .map((header) => {
          const value = this.getNestedValue(item, header);
          return this.escapeCSVField(this.stringifyValue(value));
        })
        .join(',');
    });

    // 组合标题和数据行
    return [headerRow, ...dataRows].join('\n');
  }

  /**
   * 格式化基本类型数组为 CSV
   */
  private formatPrimitiveArray(arr: unknown[]): string {
    return arr.map((item) => this.escapeCSVField(this.stringifyValue(item))).join('\n');
  }

  /**
   * 从对象数组中提取所有字段名
   */
  private extractHeaders(arr: Record<string, unknown>[]): string[] {
    // 从第一个对象获取字段
    const firstItem = arr[0];

    // 递归获取所有字段（包括嵌套字段）
    return this.flattenObjectKeys(firstItem);
  }

  /**
   * 扁平化对象键（将嵌套对象展开为点分隔符路径）
   */
  private flattenObjectKeys(obj: Record<string, unknown>, prefix = ''): string[] {
    const keys: string[] = [];

    Object.keys(obj).forEach((key) => {
      const fullKey = prefix ? `${prefix}.${key}` : key;
      const value = obj[key];

      if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
        // 嵌套对象，递归展开
        keys.push(...this.flattenObjectKeys(value as Record<string, unknown>, fullKey));
      } else {
        keys.push(fullKey);
      }
    });

    return keys;
  }

  /**
   * 获取嵌套对象的值（支持点分隔符）
   */
  private getNestedValue(obj: unknown, path: string): unknown {
    if (typeof obj !== 'object' || obj === null) {
      return undefined;
    }
    return path.split('.').reduce((current: unknown, key: string): unknown => {
      if (current && typeof current === 'object') {
        const obj = current as Record<string, unknown>;
        return obj[key] !== undefined ? obj[key] : undefined;
      }
      return undefined;
    }, obj);
  }

  /**
   * 将值转换为字符串
   */
  private stringifyValue(value: unknown): string {
    if (value === null || value === undefined) {
      return '';
    }

    if (typeof value === 'boolean') {
      return value ? 'true' : 'false';
    }

    if (typeof value === 'object') {
      return JSON.stringify(value);
    }

    return String(value);
  }

  /**
   * 转义 CSV 字段
   *
   * 规则：
   * - 如果字段包含引号、逗号、换行符，则用双引号包围
   * - 字段内的双引号需要转义为两个双引号
   */
  private escapeCSVField(field: string): string {
    // 转换为字符串
    const str = String(field);

    // 检查是否需要转义
    const needsEscape =
      str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r');

    if (needsEscape) {
      // 转义双引号（将 " 替换为 ""）
      const escaped = str.replace(/"/g, '""');
      // 用双引号包围整个字段
      return `"${escaped}"`;
    }

    return str;
  }
}
