# Todo


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**id** | **string** | 待办 ID | [default to undefined]
**title** | **string** | 待办标题 | [default to undefined]
**description** | **string** | 待办描述 | [optional] [default to undefined]
**priority** | **string** | 优先级 | [optional] [default to undefined]
**status** | **string** | 待办状态 | [default to undefined]
**assignee** | **string** | 负责人 | [optional] [default to undefined]
**dueDate** | **string** | 截止日期 | [optional] [default to undefined]
**createdAt** | **string** | 创建时间 | [optional] [default to undefined]
**updatedAt** | **string** | 更新时间 | [optional] [default to undefined]

## Example

```typescript
import { Todo } from '@ybc/api-client';

const instance: Todo = {
    id,
    title,
    description,
    priority,
    status,
    assignee,
    dueDate,
    createdAt,
    updatedAt,
};
```

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)
