# StaffQueryRequest


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**name** | **string** | 员工姓名（模糊查询） | [optional] [default to undefined]
**code** | **string** | 员工编码 | [optional] [default to undefined]
**department** | **string** | 部门名称 | [optional] [default to undefined]
**status** | **string** | 员工状态 | [optional] [default to undefined]
**page** | **number** | 页码（从 1 开始） | [optional] [default to 1]
**pageSize** | **number** | 每页记录数 | [optional] [default to 20]

## Example

```typescript
import { StaffQueryRequest } from '@ybc/api-client';

const instance: StaffQueryRequest = {
    name,
    code,
    department,
    status,
    page,
    pageSize,
};
```

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)
