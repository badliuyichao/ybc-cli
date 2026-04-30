/**
 * 输出格式化器接口定义
 *
 * 定义所有输出格式化器必须实现的接口
 */

/**
 * 支持的输出格式类型
 */
export type OutputFormat = 'json' | 'table' | 'csv' | 'raw';

/**
 * 输出格式化器接口
 *
 * 所有格式化器必须实现此接口
 */
export interface OutputFormatter {
  /**
   * 格式化数据为字符串
   * @param data - 要格式化的数据（可以是任何类型）
   * @returns 格式化后的字符串
   */
  format(data: unknown): string;
}

/**
 * 表格列配置
 */
export interface TableColumn {
  /** 列标题 */
  header: string;
  /** 数据字段名 */
  field: string;
  /** 列宽度（可选，自动计算） */
  width?: number;
  /** 对齐方式 */
  align?: 'left' | 'center' | 'right';
}

/**
 * 表格格式化选项
 */
export interface TableOptions {
  /** 列配置 */
  columns?: TableColumn[];
  /** 是否显示行号 */
  showRowNumbers?: boolean;
  /** 是否使用紧凑模式 */
  compact?: boolean;
}
