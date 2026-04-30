/**
 * Table 格式化器
 *
 * 将数据格式化为美观的表格形式，支持颜色和对齐
 */

import Table from 'cli-table3';
import chalk from 'chalk';
import { OutputFormatter, TableOptions, TableColumn } from './formatter';

/**
 * Table 格式化器类
 *
 * 特性：
 * - 自动适配终端宽度
 * - 支持列对齐和颜色
 * - 支持自定义列配置
 * - 自动处理对象数组
 */
export class TableFormatter implements OutputFormatter {
  private options: TableOptions;

  constructor(options: TableOptions = {}) {
    this.options = options;
  }

  /**
   * 格式化数据为表格字符串
   * @param data - 要格式化的数据（可以是任何类型）
   * @returns 格式化后的表格字符串
   */
  format(data: unknown): string {
    // 处理空数据
    if (!data) {
      return chalk.gray('No data');
    }

    // 处理非数组数据（单个对象）
    if (!Array.isArray(data)) {
      // 如果是对象，显示为键值对表格
      if (typeof data === 'object') {
        return this.formatObject(data as Record<string, unknown>);
      }
      // 其他类型直接返回字符串
      return String(data);
    }

    // 处理空数组
    if (data.length === 0) {
      return chalk.gray('No data');
    }

    // 处理对象数组
    if (typeof data[0] === 'object' && data[0] !== null) {
      return this.formatArray(data as Record<string, unknown>[]);
    }

    // 处理基本类型数组
    return this.formatPrimitiveArray(data as unknown[]);
  }

  /**
   * 格式化单个对象为键值对表格
   */
  private formatObject(obj: Record<string, unknown>): string {
    const table = new Table({
      head: [chalk.cyan.bold('Field'), chalk.cyan.bold('Value')],
      colWidths: [20, 60],
    });

    Object.keys(obj).forEach((key) => {
      const value = this.formatValue(obj[key]);
      table.push([chalk.yellow(key), value]);
    });

    return table.toString();
  }

  /**
   * 格式化对象数组为表格
   */
  private formatArray(arr: Record<string, unknown>[]): string {
    // 获取列配置
    const columns = this.getColumns(arr[0]);

    // 创建表格
    const table = new Table({
      head: columns.map((col) => chalk.cyan.bold(col.header)),
      colWidths: this.calculateColumnWidths(columns, arr),
    });

    // 添加数据行
    arr.forEach((item, index) => {
      const row = columns.map((col) => {
        const value = this.getNestedValue(item, col.field);
        return this.formatValue(value);
      });

      // 如果需要显示行号，添加到行首
      if (this.options.showRowNumbers) {
        row.unshift(chalk.gray(String(index + 1)));
      }

      table.push(row);
    });

    return table.toString();
  }

  /**
   * 格式化基本类型数组
   */
  private formatPrimitiveArray(arr: unknown[]): string {
    const table = new Table({
      head: this.options.showRowNumbers
        ? [chalk.gray('#'), chalk.cyan.bold('Value')]
        : [chalk.cyan.bold('Value')],
    });

    arr.forEach((item, index) => {
      const row = [this.formatValue(item)];
      if (this.options.showRowNumbers) {
        row.unshift(chalk.gray(String(index + 1)));
      }
      table.push(row);
    });

    return table.toString();
  }

  /**
   * 获取列配置
   */
  private getColumns(firstItem: Record<string, unknown>): TableColumn[] {
    // 如果提供了自定义列配置，使用它
    if (this.options.columns && this.options.columns.length > 0) {
      return this.options.columns;
    }

    // 否则从第一个对象推断列配置
    return Object.keys(firstItem).map((key) => ({
      header: this.formatHeader(key),
      field: key,
    }));
  }

  /**
   * 格式化字段名为标题（驼峰转空格分隔，首字母大写）
   */
  private formatHeader(field: string): string {
    return field
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, (str) => str.toUpperCase())
      .trim();
  }

  /**
   * 计算列宽度
   */
  private calculateColumnWidths(columns: TableColumn[], data: Record<string, unknown>[]): number[] {
    const minWidth = 10;
    const maxWidth = 50;

    return columns.map((col) => {
      // 如果提供了固定宽度，使用它
      if (col.width) {
        return col.width;
      }

      // 计算该列的最大内容宽度
      const headerWidth = col.header.length;
      const maxContentWidth = Math.max(
        headerWidth,
        ...data.map((item) => {
          const value = this.getNestedValue(item, col.field);
          const formatted = this.formatValue(value);
          return formatted.length;
        })
      );

      // 限制在最小和最大宽度之间
      return Math.min(Math.max(maxContentWidth + 2, minWidth), maxWidth);
    });
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
   * 格式化单元格值
   */
  private formatValue(value: unknown): string {
    if (value === null || value === undefined) {
      return chalk.gray('-');
    }

    if (typeof value === 'boolean') {
      return value ? chalk.green('✓') : chalk.red('✗');
    }

    if (typeof value === 'number') {
      return chalk.yellow(String(value));
    }

    if (typeof value === 'object') {
      return chalk.gray(JSON.stringify(value));
    }

    return String(value);
  }
}
