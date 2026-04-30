/**
 * Raw 格式化器测试
 */

import { RawFormatter } from '../../../../src/cli/output/raw';

describe('RawFormatter', () => {
  let formatter: RawFormatter;

  beforeEach(() => {
    formatter = new RawFormatter();
  });

  describe('format', () => {
    it('should format object without indentation', () => {
      const data = { id: 1, name: 'Alice' };
      const result = formatter.format(data);

      expect(result).toBe('{"id":1,"name":"Alice"}');
      expect(result).not.toContain('\n');
    });

    it('should format array without indentation', () => {
      const data = [
        { id: 1, name: 'Alice' },
        { id: 2, name: 'Bob' },
      ];
      const result = formatter.format(data);

      expect(result).toContain('"id":1');
      expect(result).toContain('"name":"Alice"');
      expect(result).toContain('"id":2');
      expect(result).toContain('"name":"Bob"');
      expect(result).not.toContain('\n');
    });

    it('should handle nested objects', () => {
      const data = {
        user: {
          name: 'John',
          address: {
            city: 'New York',
          },
        },
      };
      const result = formatter.format(data);

      expect(result).toContain('"user"');
      expect(result).toContain('"name":"John"');
      expect(result).toContain('"city":"New York"');
      expect(result).not.toContain('\n');
    });

    it('should handle null values', () => {
      const data = { name: 'John', age: null };
      const result = formatter.format(data);

      expect(result).toBe('{"name":"John","age":null}');
    });

    it('should handle undefined values', () => {
      const data = { name: 'John', age: undefined };
      const result = formatter.format(data);

      // undefined 值会被 JSON.stringify 忽略
      expect(result).toBe('{"name":"John"}');
    });

    it('should handle boolean values', () => {
      const data = { active: true, deleted: false };
      const result = formatter.format(data);

      expect(result).toBe('{"active":true,"deleted":false}');
    });

    it('should handle empty object', () => {
      const data = {};
      const result = formatter.format(data);

      expect(result).toBe('{}');
    });

    it('should handle empty array', () => {
      const data: any[] = [];
      const result = formatter.format(data);

      expect(result).toBe('[]');
    });

    it('should handle string values', () => {
      const data = 'simple string';
      const result = formatter.format(data);

      expect(result).toBe('"simple string"');
    });

    it('should handle number values', () => {
      const data = 42;
      const result = formatter.format(data);

      expect(result).toBe('42');
    });

    it('should handle primitive array', () => {
      const data = [1, 2, 3];
      const result = formatter.format(data);

      expect(result).toBe('[1,2,3]');
    });

    it('should handle special characters in strings', () => {
      const data = { message: 'Hello "World"' };
      const result = formatter.format(data);

      expect(result).toBe('{"message":"Hello \\"World\\""}');
    });

    it('should handle unicode characters', () => {
      const data = { name: '张三', city: '北京' };
      const result = formatter.format(data);

      expect(result).toContain('"name":"张三"');
      expect(result).toContain('"city":"北京"');
    });

    it('should not have any whitespace', () => {
      const data = {
        id: 1,
        name: 'Alice',
        email: 'alice@example.com',
      };
      const result = formatter.format(data);

      // 确保没有换行符
      expect(result).not.toContain('\n');
      expect(result).not.toContain('\r');
      // 确保没有多余的空格（键值对之间除外）
      expect(result).toMatch(/^\{("[^"]+":("[^"]*"|[^,}]+),?)+\}$/);
    });
  });
});
