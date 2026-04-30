# TodoCreateRequest


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**title** | **string** | 待办标题 | [default to undefined]
**description** | **string** | 待办描述 | [optional] [default to undefined]
**priority** | **string** | 优先级 | [optional] [default to PriorityEnum_Medium]
**assignee** | **string** | 负责人 | [optional] [default to undefined]
**dueDate** | **string** | 截止日期 | [optional] [default to undefined]

## Example

```typescript
import { TodoCreateRequest } from '@ybc/api-client';

const instance: TodoCreateRequest = {
    title,
    description,
    priority,
    assignee,
    dueDate,
};
```

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)
