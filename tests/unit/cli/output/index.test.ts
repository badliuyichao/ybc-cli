/**
 * 输出管理器测试
 */

import { OutputManager } from '../../../../src/cli/output/index';
import { JsonFormatter } from '../../../../src/cli/output/json';
import { TableFormatter } from '../../../../src/cli/output/table';
import { CsvFormatter } from '../../../../src/cli/output/csv';
import { RawFormatter } from '../../../../src/cli/output/raw';

describe('OutputManager', () => {
  let manager: OutputManager;

  beforeEach(() => {
    manager = new OutputManager();
  });

  describe('getFormatter', () => {
    it('should return JsonFormatter for json format', () => {
      const formatter = manager.getFormatter('json');
      expect(formatter).toBeInstanceOf(JsonFormatter);
    });

    it('should return TableFormatter for table format', () => {
      const formatter = manager.getFormatter('table');
      expect(formatter).toBeInstanceOf(TableFormatter);
    });

    it('should return CsvFormatter for csv format', () => {
      const formatter = manager.getFormatter('csv');
      expect(formatter).toBeInstanceOf(CsvFormatter);
    });

    it('should return RawFormatter for raw format', () => {
      const formatter = manager.getFormatter('raw');
      expect(formatter).toBeInstanceOf(RawFormatter);
    });

    it('should throw error for unsupported format', () => {
      expect(() => {
        manager.getFormatter('unsupported' as any);
      }).toThrow('Unsupported output format: unsupported');
    });

    it('should pass options to TableFormatter', () => {
      const options = {
        showRowNumbers: true,
        columns: [{ header: 'ID', field: 'id' }],
      };
      const formatter = manager.getFormatter('table', options);
      expect(formatter).toBeInstanceOf(TableFormatter);
    });
  });

  describe('output', () => {
    let consoleSpy: jest.SpyInstance;

    beforeEach(() => {
      consoleSpy = jest.spyOn(console, 'log').mockImplementation();
    });

    afterEach(() => {
      consoleSpy.mockRestore();
    });

    it('should output data in json format', () => {
      const data = { id: 1, name: 'Alice' };
      manager.output(data, 'json');

      expect(consoleSpy).toHaveBeenCalled();
      const output = consoleSpy.mock.calls[0][0];
      expect(output).toContain('"id"');
      expect(output).toContain('"name"');
      expect(output).toContain('Alice');
    });

    it('should output data in table format by default', () => {
      const data = [{ id: 1, name: 'Alice' }];
      manager.output(data);

      expect(consoleSpy).toHaveBeenCalled();
      const output = consoleSpy.mock.calls[0][0];
      expect(output).toContain('Alice');
    });

    it('should output data in csv format', () => {
      const data = [{ id: 1, name: 'Alice' }];
      manager.output(data, 'csv');

      expect(consoleSpy).toHaveBeenCalled();
      const output = consoleSpy.mock.calls[0][0];
      expect(output).toContain('id,name');
      expect(output).toContain('1,Alice');
    });

    it('should output data in raw format', () => {
      const data = { id: 1, name: 'Alice' };
      manager.output(data, 'raw');

      expect(consoleSpy).toHaveBeenCalled();
      const output = consoleSpy.mock.calls[0][0];
      expect(output).toBe('{"id":1,"name":"Alice"}');
    });

    it('should pass options to table formatter', () => {
      const data = [{ id: 1, name: 'Alice' }];
      const options = {
        showRowNumbers: true,
      };
      manager.output(data, 'table', options);

      expect(consoleSpy).toHaveBeenCalled();
    });
  });
});

describe('Exports', () => {
  // TypeScript 类型不能通过 require 导出，这些测试仅验证类的导出
  it('should export JsonFormatter', () => {
    const { JsonFormatter } = require('../../../../src/cli/output/index');
    expect(JsonFormatter).toBeDefined();
  });

  it('should export TableFormatter', () => {
    const { TableFormatter } = require('../../../../src/cli/output/index');
    expect(TableFormatter).toBeDefined();
  });

  it('should export CsvFormatter', () => {
    const { CsvFormatter } = require('../../../../src/cli/output/index');
    expect(CsvFormatter).toBeDefined();
  });

  it('should export RawFormatter', () => {
    const { RawFormatter } = require('../../../../src/cli/output/index');
    expect(RawFormatter).toBeDefined();
  });

  it('should export OutputManager as default', () => {
    const exports = require('../../../../src/cli/output/index');
    expect(exports.default).toBe(OutputManager);
  });
});
