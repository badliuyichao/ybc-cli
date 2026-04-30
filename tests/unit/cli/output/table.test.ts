/**
 * Table 格式化器测试
 */

import { TableFormatter } from '../../../../src/cli/output/table';

describe('TableFormatter', () => {
  let formatter: TableFormatter;

  beforeEach(() => {
    formatter = new TableFormatter();
  });

  describe('format', () => {
    describe('with object array', () => {
      it('should format array of objects as table', () => {
        const data = [
          { id: 1, name: 'Alice', age: 30 },
          { id: 2, name: 'Bob', age: 25 },
        ];
        const result = formatter.format(data);

        expect(result).toContain('Id');
        expect(result).toContain('Name');
        expect(result).toContain('Age');
        expect(result).toContain('Alice');
        expect(result).toContain('Bob');
      });

      it('should handle empty array', () => {
        const data: any[] = [];
        const result = formatter.format(data);

        expect(result).toContain('No data');
      });

      it('should handle nested objects', () => {
        const data = [
          {
            id: 1,
            user: { name: 'Alice', city: 'New York' },
          },
        ];
        const result = formatter.format(data);

        expect(result).toContain('Alice');
      });

      it('should handle null values', () => {
        const data = [{ id: 1, name: null, age: 30 }];
        const result = formatter.format(data);

        expect(result).toContain('1');
        expect(result).toContain('30');
      });

      it('should handle undefined values', () => {
        const data = [{ id: 1, name: undefined }];
        const result = formatter.format(data);

        expect(result).toContain('1');
      });
    });

    describe('with single object', () => {
      it('should format single object as key-value table', () => {
        const data = { id: 1, name: 'Alice', age: 30 };
        const result = formatter.format(data);

        expect(result).toContain('Field');
        expect(result).toContain('Value');
        expect(result).toContain('id');
        expect(result).toContain('name');
        expect(result).toContain('age');
        expect(result).toContain('Alice');
      });

      it('should handle empty object', () => {
        const data = {};
        const result = formatter.format(data);

        expect(result).toContain('Field');
        expect(result).toContain('Value');
      });
    });

    describe('with primitive values', () => {
      it('should format primitive array', () => {
        const data = ['apple', 'banana', 'cherry'];
        const result = formatter.format(data);

        expect(result).toContain('apple');
        expect(result).toContain('banana');
        expect(result).toContain('cherry');
      });

      it('should format single primitive value', () => {
        const data = 'simple string';
        const result = formatter.format(data);

        expect(result).toBe('simple string');
      });

      it('should format number', () => {
        const data = 42;
        const result = formatter.format(data);

        expect(result).toBe('42');
      });
    });

    describe('with null and undefined', () => {
      it('should handle null data', () => {
        const result = formatter.format(null);
        expect(result).toContain('No data');
      });

      it('should handle undefined data', () => {
        const result = formatter.format(undefined);
        expect(result).toContain('No data');
      });
    });

    describe('with custom options', () => {
      it('should show row numbers when enabled', () => {
        const formatterWithOptions = new TableFormatter({
          showRowNumbers: true,
        });
        const data = [
          { id: 1, name: 'Alice' },
          { id: 2, name: 'Bob' },
        ];
        const result = formatterWithOptions.format(data);

        expect(result).toContain('1');
        expect(result).toContain('2');
      });

      it('should use custom columns when provided', () => {
        const formatterWithOptions = new TableFormatter({
          columns: [
            { header: 'ID', field: 'id', width: 10 },
            { header: 'Name', field: 'name', width: 20 },
          ],
        });
        const data = [
          { id: 1, name: 'Alice', age: 30 },
          { id: 2, name: 'Bob', age: 25 },
        ];
        const result = formatterWithOptions.format(data);

        expect(result).toContain('ID');
        expect(result).toContain('Name');
        // age 列不应该出现，因为自定义列中没有定义
      });
    });

    describe('boolean formatting', () => {
      it('should format true as checkmark', () => {
        const data = [{ active: true }];
        const result = formatter.format(data);

        expect(result).toContain('✓');
      });

      it('should format false as cross', () => {
        const data = [{ active: false }];
        const result = formatter.format(data);

        expect(result).toContain('✗');
      });
    });
  });

  describe('formatHeader', () => {
    it('should convert camelCase to spaces', () => {
      const data = [{ userName: 'Alice', userId: 1 }];
      const result = formatter.format(data);

      expect(result).toContain('User Name');
      expect(result).toContain('User Id');
    });

    it('should capitalize first letter', () => {
      const data = [{ name: 'Alice' }];
      const result = formatter.format(data);

      expect(result).toContain('Name');
    });
  });
});
