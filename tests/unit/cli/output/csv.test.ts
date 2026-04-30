/**
 * CSV 格式化器测试
 */

import { CsvFormatter } from '../../../../src/cli/output/csv';

describe('CsvFormatter', () => {
  let formatter: CsvFormatter;

  beforeEach(() => {
    formatter = new CsvFormatter();
  });

  describe('format', () => {
    describe('with object array', () => {
      it('should format array of objects as CSV', () => {
        const data = [
          { id: 1, name: 'Alice', age: 30 },
          { id: 2, name: 'Bob', age: 25 },
        ];
        const result = formatter.format(data);
        const lines = result.split('\n');

        expect(lines[0]).toBe('id,name,age');
        expect(lines[1]).toBe('1,Alice,30');
        expect(lines[2]).toBe('2,Bob,25');
      });

      it('should handle empty array', () => {
        const data: any[] = [];
        const result = formatter.format(data);

        expect(result).toBe('');
      });

      it('should handle nested objects', () => {
        const data = [
          {
            id: 1,
            user: { name: 'Alice' },
          },
        ];
        const result = formatter.format(data);

        expect(result).toContain('id,user.name');
        expect(result).toContain('Alice');
      });

      it('should handle null values', () => {
        const data = [{ id: 1, name: null, age: 30 }];
        const result = formatter.format(data);
        const lines = result.split('\n');

        expect(lines[0]).toBe('id,name,age');
        expect(lines[1]).toBe('1,,30');
      });

      it('should handle undefined values', () => {
        const data = [{ id: 1, name: undefined }];
        const result = formatter.format(data);
        const lines = result.split('\n');

        expect(lines[0]).toBe('id,name');
        expect(lines[1]).toBe('1,');
      });

      it('should handle boolean values', () => {
        const data = [{ active: true, deleted: false }];
        const result = formatter.format(data);
        const lines = result.split('\n');

        expect(lines[0]).toBe('active,deleted');
        expect(lines[1]).toBe('true,false');
      });
    });

    describe('with single object', () => {
      it('should format single object as CSV', () => {
        const data = { id: 1, name: 'Alice' };
        const result = formatter.format(data);
        const lines = result.split('\n');

        expect(lines[0]).toBe('id,name');
        expect(lines[1]).toBe('1,Alice');
      });
    });

    describe('with primitive values', () => {
      it('should format primitive array', () => {
        const data = ['apple', 'banana', 'cherry'];
        const result = formatter.format(data);
        const lines = result.split('\n');

        expect(lines[0]).toBe('apple');
        expect(lines[1]).toBe('banana');
        expect(lines[2]).toBe('cherry');
      });

      it('should format number', () => {
        const data = 42;
        const result = formatter.format(data);

        expect(result).toBe('42');
      });

      it('should format string', () => {
        const data = 'simple string';
        const result = formatter.format(data);

        expect(result).toBe('simple string');
      });
    });

    describe('with null and undefined', () => {
      it('should handle null data', () => {
        const result = formatter.format(null);
        expect(result).toBe('');
      });

      it('should handle undefined data', () => {
        const result = formatter.format(undefined);
        expect(result).toBe('');
      });
    });

    describe('CSV escaping', () => {
      it('should escape fields with commas', () => {
        const data = [{ name: 'John, Doe', age: 30 }];
        const result = formatter.format(data);
        const lines = result.split('\n');

        expect(lines[0]).toBe('name,age');
        expect(lines[1]).toBe('"John, Doe",30');
      });

      it('should escape fields with quotes', () => {
        const data = [{ message: 'Hello "World"' }];
        const result = formatter.format(data);
        const lines = result.split('\n');

        expect(lines[0]).toBe('message');
        expect(lines[1]).toBe('"Hello ""World"""');
      });

      it('should escape fields with newlines', () => {
        const data = [{ text: 'Line 1\nLine 2' }];
        const result = formatter.format(data);
        const lines = result.split('\n');

        expect(lines[0]).toBe('text');
        expect(lines[1]).toBe('"Line 1');
        expect(lines[2]).toBe('Line 2"');
      });

      it('should escape fields with carriage returns', () => {
        const data = [{ text: 'Line 1\r\nLine 2' }];
        const result = formatter.format(data);

        expect(result).toContain('"');
      });

      it('should handle multiple special characters', () => {
        const data = [{ text: 'A, B, "C"' }];
        const result = formatter.format(data);
        const lines = result.split('\n');

        expect(lines[0]).toBe('text');
        expect(lines[1]).toBe('"A, B, ""C"""');
      });
    });

    describe('Unicode support', () => {
      it('should handle Chinese characters', () => {
        const data = [{ name: '张三', city: '北京' }];
        const result = formatter.format(data);
        const lines = result.split('\n');

        expect(lines[0]).toBe('name,city');
        expect(lines[1]).toBe('张三,北京');
      });

      it('should handle emoji', () => {
        const data = [{ emoji: '😀' }];
        const result = formatter.format(data);

        expect(result).toContain('😀');
      });
    });
  });
});
