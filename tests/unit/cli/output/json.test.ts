/**
 * JSON 格式化器测试
 */

import { JsonFormatter } from '../../../../src/cli/output/json';

describe('JsonFormatter', () => {
  let formatter: JsonFormatter;

  beforeEach(() => {
    formatter = new JsonFormatter();
  });

  describe('format', () => {
    it('should format simple object with indentation', () => {
      const data = { name: 'John', age: 30 };
      const result = formatter.format(data);

      expect(result).toContain('"name": "John"');
      expect(result).toContain('"age": 30');
      expect(result.split('\n').length).toBeGreaterThan(1);
    });

    it('should format array correctly', () => {
      const data = [
        { id: 1, name: 'Alice' },
        { id: 2, name: 'Bob' },
      ];
      const result = formatter.format(data);

      expect(result).toContain('"id": 1');
      expect(result).toContain('"name": "Alice"');
      expect(result).toContain('"id": 2');
      expect(result).toContain('"name": "Bob"');
    });

    it('should handle nested objects', () => {
      const data = {
        user: {
          name: 'John',
          address: {
            city: 'New York',
            country: 'USA',
          },
        },
      };
      const result = formatter.format(data);

      expect(result).toContain('"user"');
      expect(result).toContain('"name": "John"');
      expect(result).toContain('"city": "New York"');
    });

    it('should handle null values', () => {
      const data = { name: 'John', age: null };
      const result = formatter.format(data);

      expect(result).toContain('"name": "John"');
      expect(result).toContain('"age": null');
    });

    it('should handle undefined values', () => {
      const data = { name: 'John', age: undefined };
      const result = formatter.format(data);

      expect(result).toContain('"name": "John"');
      // undefined 值会被 JSON.stringify 忽略
      expect(result).not.toContain('age');
    });

    it('should handle boolean values', () => {
      const data = { active: true, deleted: false };
      const result = formatter.format(data);

      expect(result).toContain('"active": true');
      expect(result).toContain('"deleted": false');
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
      const data = [1, 2, 3, 4, 5];
      const result = formatter.format(data);

      expect(result).toBe('[\n  1,\n  2,\n  3,\n  4,\n  5\n]');
    });

    it('should sort keys for stable output', () => {
      const data = { z: 1, a: 2, m: 3 };
      const result = formatter.format(data);

      // 键应该按字母顺序排序
      const lines = result.split('\n');
      expect(lines[0]).toBe('{');
      expect(lines[1]).toContain('"a"');
      expect(lines[2]).toContain('"m"');
      expect(lines[3]).toContain('"z"');
    });

    it('should handle special characters in strings', () => {
      const data = { message: 'Hello "World"' };
      const result = formatter.format(data);

      expect(result).toContain('"message": "Hello \\"World\\""');
    });

    it('should handle unicode characters', () => {
      const data = { name: '张三', city: '北京' };
      const result = formatter.format(data);

      expect(result).toContain('"name": "张三"');
      expect(result).toContain('"city": "北京"');
    });
  });
});
