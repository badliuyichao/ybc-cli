/**
 * Mock BIP API Server
 *
 * 用于测试的 Mock 服务器，模拟用友 BIP API 的关键端点
 */

import express, { Request, Response } from 'express';
import { Server } from 'http';

export interface MockBipServerConfig {
  port?: number;
  tokenEndpoint?: string;
  staffQueryEndpoint?: string;
  todoListEndpoint?: string;
}

export interface MockTokenResponse {
  code: string;
  message: string;
  data: {
    access_token: string;
    expires_in: number;
    token_type: string;
  };
}

export interface MockStaffQueryResponse {
  code: string;
  message: string;
  data: {
    staffs: Array<{
      code: string;
      name: string;
      department: string;
      status: 'enabled' | 'disabled';
    }>;
    total: number;
  };
}

export interface MockTodoListResponse {
  code: string;
  message: string;
  data: {
    todos: Array<{
      id: string;
      title: string;
      status: 'pending' | 'completed';
      assignee: string;
      dueDate: string;
    }>;
    total: number;
  };
}

export class MockBipServer {
  private app: express.Application;
  private server: Server | null = null;
  private config: MockBipServerConfig;
  private validTokens: Set<string> = new Set();

  constructor(config: MockBipServerConfig = {}) {
    this.config = {
      port: config.port || 3000,
      tokenEndpoint: config.tokenEndpoint || '/open-auth/selfAppAuth/base/v1/getAccessToken',
      staffQueryEndpoint: config.staffQueryEndpoint || '/api/staff/query',
      todoListEndpoint: config.todoListEndpoint || '/api/todo/list',
    };

    this.app = express();
    this.app.use(express.json());
    this.setupRoutes();
  }

  private setupRoutes(): void {
    // Token 端点 - 同时支持 GET 和 POST
    this.app.post(this.config.tokenEndpoint!, (req: Request, res: Response) => {
      this.handleTokenRequest(req, res);
    });
    this.app.get(this.config.tokenEndpoint!, (req: Request, res: Response) => {
      this.handleTokenRequest(req, res);
    });

    // Staff Query 端点
    this.app.post(this.config.staffQueryEndpoint!, (req: Request, res: Response) => {
      this.handleStaffQuery(req, res);
    });

    // Todo List 端点
    this.app.post(this.config.todoListEndpoint!, (req: Request, res: Response) => {
      this.handleTodoList(req, res);
    });

    // 错误场景端点
    this.app.get('/api/error/401', (req: Request, res: Response) => {
      res.status(401).json({
        code: 'UNAUTHORIZED',
        message: 'Invalid token',
      });
    });

    this.app.get('/api/error/429', (req: Request, res: Response) => {
      res.status(429).json({
        code: 'RATE_LIMIT',
        message: 'Too many requests',
      });
    });

    this.app.get('/api/error/500', (req: Request, res: Response) => {
      res.status(500).json({
        code: 'INTERNAL_ERROR',
        message: 'Internal server error',
      });
    });
  }

  private handleTokenRequest(req: Request, res: Response): void {
    // 支持 GET 请求 (query parameters) 和 POST 请求 (JSON body)
    const ak = (req.query as any)?.ak || (req.body as any)?.ak;
    const sk = (req.query as any)?.sk || (req.body as any)?.sk;

    // 验证 AK/SK
    if (!ak || !sk || ak.length < 8 || sk.length < 14) {
      res.status(401).json({
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid AK/SK',
      });
      return;
    }

    // 生成 mock token
    const token = `mock-token-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    this.validTokens.add(token);

    const response: MockTokenResponse = {
      code: '00000',
      message: '成功',
      data: {
        access_token: token,
        expires_in: 3600, // 1 hour
        token_type: 'Bearer',
      },
    };

    res.json(response);
  }

  private handleStaffQuery(req: Request, res: Response): void {
    // 验证 Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        code: 'UNAUTHORIZED',
        message: 'Missing or invalid authorization header',
      });
      return;
    }

    const token = authHeader.substring(7);
    if (!this.validTokens.has(token)) {
      res.status(401).json({
        code: 'INVALID_TOKEN',
        message: 'Token is invalid or expired',
      });
      return;
    }

    // 处理查询参数以模拟不同业务错误
    const { code, department } = req.query as { code?: string; department?: string };

    // INVALID_CODE 返回 NOT_FOUND 错误
    if (code === 'INVALID_CODE') {
      res.status(404).json({
        code: 'NOT_FOUND',
        message: '资源不存在：指定的员工编码不存在',
      });
      return;
    }

    // SECRET_DEPT 返回权限错误
    if (department === 'SECRET_DEPT') {
      res.status(403).json({
        code: 'PERMISSION_DENIED',
        message: '权限不足：您没有权限访问该部门的数据',
      });
      return;
    }

    // page 为负数返回验证错误
    const page = req.query.page as string;
    if (page && parseInt(page, 10) < 0) {
      res.status(400).json({
        code: 'INVALID_PARAMETER',
        message: '参数验证失败：page 参数必须为非负整数',
      });
      return;
    }

    // Mock staff data
    const response: MockStaffQueryResponse = {
      code: 'SUCCESS',
      message: '查询成功',
      data: {
        staffs: [
          {
            code: 'EMP001',
            name: '张三',
            department: '研发部',
            status: 'enabled',
          },
          {
            code: 'EMP002',
            name: '李四',
            department: '产品部',
            status: 'enabled',
          },
          {
            code: 'EMP003',
            name: '王五',
            department: '测试部',
            status: 'disabled',
          },
        ],
        total: 3,
      },
    };

    res.json(response);
  }

  private handleTodoList(req: Request, res: Response): void {
    // 验证 Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        code: 'UNAUTHORIZED',
        message: 'Missing or invalid authorization header',
      });
      return;
    }

    const token = authHeader.substring(7);
    if (!this.validTokens.has(token)) {
      res.status(401).json({
        code: 'INVALID_TOKEN',
        message: 'Token is invalid or expired',
      });
      return;
    }

    // Mock todo data
    const response: MockTodoListResponse = {
      code: 'SUCCESS',
      message: '查询成功',
      data: {
        todos: [
          {
            id: 'TODO001',
            title: '完成Phase1验收',
            status: 'pending',
            assignee: '张三',
            dueDate: '2026-04-30',
          },
          {
            id: 'TODO002',
            title: '编写测试报告',
            status: 'pending',
            assignee: '李四',
            dueDate: '2026-05-01',
          },
          {
            id: 'TODO003',
            title: '代码审查',
            status: 'completed',
            assignee: '王五',
            dueDate: '2026-04-25',
          },
        ],
        total: 3,
      },
    };

    res.json(response);
  }

  /**
   * 启动 Mock Server
   */
  async start(): Promise<void> {
    return new Promise((resolve) => {
      this.server = this.app.listen(this.config.port!, () => {
        console.log(`Mock BIP Server started on port ${this.config.port}`);
        resolve();
      });
    });
  }

  /**
   * 停止 Mock Server
   */
  async stop(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.server) {
        resolve();
        return;
      }

      this.server.close((err) => {
        if (err) {
          reject(err);
        } else {
          this.server = null;
          this.validTokens.clear();
          resolve();
        }
      });
    });
  }

  /**
   * 获取 Server URL
   */
  getUrl(): string {
    return `http://localhost:${this.config.port}`;
  }

  /**
   * 清除所有有效 token
   */
  clearTokens(): void {
    this.validTokens.clear();
  }

  /**
   * 添加有效 token
   */
  addValidToken(token: string): void {
    this.validTokens.add(token);
  }

  /**
   * 移除有效 token
   */
  removeValidToken(token: string): void {
    this.validTokens.delete(token);
  }
}

/**
 * 创建 Mock Server 实例
 */
export function createMockBipServer(config?: MockBipServerConfig): MockBipServer {
  return new MockBipServer(config);
}