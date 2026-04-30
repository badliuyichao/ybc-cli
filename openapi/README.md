# OpenAPI 规范和生成器

本目录包含 OpenAPI 规范文件和生成器配置，用于自动生成 TypeScript API 客户端。

## 目录结构

```
openapi/
├── openapi.yaml           # OpenAPI 3.0 规范文件
├── generator-config.yaml  # OpenAPI Generator 配置
└── README.md              # 本文件
```

## 已定义的 API 业务域

### 1. Staff（人员管理）

- `GET /staff/query` - 查询人员信息
  - 支持按姓名、编码、部门、状态筛选
  - 支持分页查询

- `POST /staff/{id}/enable` - 启用员工

- `POST /staff/{id}/disable` - 禁用员工

### 2. Todo（待办事项）

- `GET /todo/list` - 获取待办列表
  - 支持按状态、优先级、负责人筛选
  - 支持分页查询

- `POST /todo/create` - 创建待办

## 生成 API 客户端

### 命令

```bash
npm run generate:api
```

### 生成位置

生成的 TypeScript 客户端代码位于：`src/api/generated/`

### 生成的文件

- `api.ts` - API 客户端类（StaffApi, TodoApi）
- `base.ts` - 基础 API 类
- `common.ts` - 通用工具函数
- `configuration.ts` - 配置接口
- `index.ts` - 导出入口
- `docs/` - API 文档（Markdown 格式）

## 使用生成的 API 客户端

### 基本用法

```typescript
import { StaffApi, TodoApi, Configuration } from './api/generated';

// 创建配置
const config = new Configuration({
  basePath: 'https://openapi-sit.yonyoucloud.com',
  accessToken: 'your-access-token', // Bearer token
});

// 创建 API 实例
const staffApi = new StaffApi(config);
const todoApi = new TodoApi(config);

// 调用 API
const staffResponse = await staffApi.queryStaff({
  name: '张三',
  status: 'active',
  page: 1,
  pageSize: 20,
});

const todoResponse = await todoApi.listTodos({
  status: 'pending',
  priority: 'high',
  page: 1,
  pageSize: 20,
});
```

### 自定义 Axios 实例

```typescript
import axios from 'axios';
import { StaffApi, Configuration } from './api/generated';

// 创建自定义 axios 实例
const axiosInstance = axios.create({
  timeout: 30000,
  headers: {
    'X-Custom-Header': 'value',
  },
});

// 添加请求拦截器（自动注入 token）
axiosInstance.interceptors.request.use((config) => {
  const token = getToken(); // 从你的 token 管理器获取
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// 创建 API 实例
const api = new StaffApi(new Configuration(), undefined, axiosInstance);
```

## 更新 OpenAPI 规范

当需要添加新的 API 端点时：

1. 编辑 `openapi/openapi.yaml`，添加新的路径定义
2. 运行 `npm run generate:api` 重新生成客户端
3. 更新相关的 Service 层和 CLI 命令

### 添加新业务域示例

```yaml
paths:
  /department/list:
    get:
      tags:
        - department
      summary: 获取部门列表
      operationId: listDepartments
      responses:
        '200':
          description: 成功
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/DepartmentListResponse'

tags:
  - name: department
    description: 部门管理 API
```

## 验证 OpenAPI 规范

```bash
npm run validate:openapi
```

此命令会验证 `openapi.yaml` 文件是否符合 OpenAPI 3.0 规范。

## 服务器配置

规范中定义了两个服务器：

1. **Sandbox（沙箱环境）**: `https://openapi-sit.yonyoucloud.com`
   - 用于开发和测试

2. **Production（生产环境）**: `https://openapi.yonyoucloud.com`
   - 用于生产环境

可以通过 Configuration 的 `basePath` 参数选择使用哪个服务器。

## 认证

所有 API 调用需要 Bearer Token 认证：

```yaml
security:
  - bearerAuth: []
```

Token 通过 AK/SK 签名机制从用友 BIP 平台获取，详见鉴权文档。

## 下一步

1. 实现 `src/services/auth/token-manager.ts` - Token 生命周期管理
2. 实现 `src/services/` - 业务逻辑层
3. 实现 `src/cli/commands/` - CLI 命令层
4. 创建命令生成脚本 `scripts/generate-commands.ts` - 从 API 客户端生成 CLI 命令

## 参考资料

- [OpenAPI 3.0 规范](https://swagger.io/specification/)
- [OpenAPI Generator - TypeScript Axios](https://openapi-generator.tech/docs/generators/typescript-axios)
- [用友 BIP OpenAPI 文档](https://openapi.yonyoucloud.com)