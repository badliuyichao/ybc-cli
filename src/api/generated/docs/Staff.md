# Staff


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**id** | **string** | 员工 ID | [default to undefined]
**name** | **string** | 员工姓名 | [default to undefined]
**code** | **string** | 员工编码 | [default to undefined]
**department** | **string** | 部门名称 | [optional] [default to undefined]
**position** | **string** | 职位 | [optional] [default to undefined]
**email** | **string** | 邮箱 | [optional] [default to undefined]
**phone** | **string** | 手机号 | [optional] [default to undefined]
**status** | **string** | 员工状态 | [default to undefined]
**createdAt** | **string** | 创建时间 | [optional] [default to undefined]
**updatedAt** | **string** | 更新时间 | [optional] [default to undefined]

## Example

```typescript
import { Staff } from '@ybc/api-client';

const instance: Staff = {
    id,
    name,
    code,
    department,
    position,
    email,
    phone,
    status,
    createdAt,
    updatedAt,
};
```

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)
