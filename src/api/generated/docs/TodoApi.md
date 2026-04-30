# TodoApi

All URIs are relative to *https://openapi-sit.yonyoucloud.com*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**createTodo**](#createtodo) | **POST** /todo/create | 创建待办|
|[**listTodos**](#listtodos) | **GET** /todo/list | 获取待办列表|

# **createTodo**
> TodoCreateResponse createTodo(todoCreateRequest)

创建新的待办事项

### Example

```typescript
import {
    TodoApi,
    Configuration,
    TodoCreateRequest
} from '@ybc/api-client';

const configuration = new Configuration();
const apiInstance = new TodoApi(configuration);

let todoCreateRequest: TodoCreateRequest; //

const { status, data } = await apiInstance.createTodo(
    todoCreateRequest
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **todoCreateRequest** | **TodoCreateRequest**|  | |


### Return type

**TodoCreateResponse**

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | 创建成功 |  -  |
|**400** | 请求参数错误 |  -  |
|**401** | 未授权 |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **listTodos**
> TodoListResponse listTodos()

查询待办事项列表，支持按状态、优先级、负责人筛选和分页

### Example

```typescript
import {
    TodoApi,
    Configuration
} from '@ybc/api-client';

const configuration = new Configuration();
const apiInstance = new TodoApi(configuration);

let status: 'pending' | 'in_progress' | 'completed'; //待办状态筛选 (optional) (default to undefined)
let priority: 'high' | 'medium' | 'low'; //优先级筛选 (optional) (default to undefined)
let assignee: string; //负责人筛选 (optional) (default to undefined)
let page: number; //页码（从 1 开始） (optional) (default to 1)
let pageSize: number; //每页记录数 (optional) (default to 20)

const { status, data } = await apiInstance.listTodos(
    status,
    priority,
    assignee,
    page,
    pageSize
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **status** | [**&#39;pending&#39; | &#39;in_progress&#39; | &#39;completed&#39;**]**Array<&#39;pending&#39; &#124; &#39;in_progress&#39; &#124; &#39;completed&#39;>** | 待办状态筛选 | (optional) defaults to undefined|
| **priority** | [**&#39;high&#39; | &#39;medium&#39; | &#39;low&#39;**]**Array<&#39;high&#39; &#124; &#39;medium&#39; &#124; &#39;low&#39;>** | 优先级筛选 | (optional) defaults to undefined|
| **assignee** | [**string**] | 负责人筛选 | (optional) defaults to undefined|
| **page** | [**number**] | 页码（从 1 开始） | (optional) defaults to 1|
| **pageSize** | [**number**] | 每页记录数 | (optional) defaults to 20|


### Return type

**TodoListResponse**

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | 查询成功 |  -  |
|**401** | 未授权 |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

