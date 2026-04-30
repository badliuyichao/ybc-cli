/**
 * 输出管理器
 *
 * 提供统一的输出格式化接口
 */

import { OutputFormatter, OutputFormat } from './formatter';
import { JsonFormatter } from './json';
import { TableFormatter } from './table';
import { CsvFormatter } from './csv';
import { RawFormatter } from './raw';
import { TableOptions } from './formatter';

/**
 * 输出管理器类
 *
 * 负责根据格式类型选择合适的格式化器
 */
export class OutputManager {
  /**
   * 获取指定格式的格式化器
   * @param format - 输出格式
   * @param options - 格式化选项（仅对 table 格式有效）
   * @returns 对应的格式化器实例
   */
  getFormatter(format: OutputFormat, options?: TableOptions): OutputFormatter {
    switch (format) {
      case 'json':
        return new JsonFormatter();
      case 'table':
        return new TableFormatter(options);
      case 'csv':
        return new CsvFormatter();
      case 'raw':
        return new RawFormatter();
      default:
        throw new Error(`Unsupported output format: ${format}`);
    }
  }

  /**
   * 输出数据到控制台
   * @param data - 要输出的数据（可以是任何类型）
   * @param format - 输出格式
   * @param options - 格式化选项
   */
  output(data: unknown, format: OutputFormat = 'table', options?: TableOptions): void {
    const formatter = this.getFormatter(format, options);
    const output = formatter.format(data);
    console.log(output);
  }
}

// 导出所有类型和类
export { OutputFormatter, OutputFormat, TableColumn, TableOptions } from './formatter';
export { JsonFormatter } from './json';
export { TableFormatter } from './table';
export { CsvFormatter } from './csv';
export { RawFormatter } from './raw';

// 默认导出
export default OutputManager;
