# TodoListRequest


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**status** | **string** | 待办状态筛选 | [optional] [default to undefined]
**priority** | **string** | 优先级筛选 | [optional] [default to undefined]
**assignee** | **string** | 负责人筛选 | [optional] [default to undefined]
**page** | **number** | 页码（从 1 开始） | [optional] [default to 1]
**pageSize** | **number** | 每页记录数 | [optional] [default to 20]

## Example

```typescript
import { TodoListRequest } from '@ybc/api-client';

const instance: TodoListRequest = {
    status,
    priority,
    assignee,
    page,
    pageSize,
};
```

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)
