/**
 * 格式化器接口测试
 */

import {
  OutputFormat,
  OutputFormatter,
  TableColumn,
  TableOptions,
} from '../../../../src/cli/output/formatter';

describe('OutputFormatter Interface', () => {
  it('should define OutputFormat type correctly', () => {
    const formats: OutputFormat[] = ['json', 'table', 'csv', 'raw'];
    expect(formats).toHaveLength(4);
  });

  it('should implement OutputFormatter interface', () => {
    const formatter: OutputFormatter = {
      format: (data: any) => JSON.stringify(data),
    };

    expect(formatter.format).toBeDefined();
    expect(typeof formatter.format).toBe('function');
    expect(formatter.format({ test: 'value' })).toBe('{"test":"value"}');
  });

  it('should define TableColumn interface correctly', () => {
    const column: TableColumn = {
      header: 'Name',
      field: 'name',
      width: 20,
      align: 'left',
    };

    expect(column.header).toBe('Name');
    expect(column.field).toBe('name');
    expect(column.width).toBe(20);
    expect(column.align).toBe('left');
  });

  it('should define TableOptions interface correctly', () => {
    const options: TableOptions = {
      columns: [{ header: 'ID', field: 'id' }],
      showRowNumbers: true,
      compact: false,
    };

    expect(options.columns).toBeDefined();
    expect(options.columns).toHaveLength(1);
    expect(options.showRowNumbers).toBe(true);
    expect(options.compact).toBe(false);
  });
});
