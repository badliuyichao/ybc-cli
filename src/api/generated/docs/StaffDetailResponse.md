# StaffDetailResponse


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**code** | **string** | 返回码，调用成功时返回 200 | [optional] [default to undefined]
**message** | **string** | 调用失败时的错误信息 | [optional] [default to undefined]
**data** | [**StaffDetailResponseData**](StaffDetailResponseData.md) |  | [optional] [default to undefined]

## Example

```typescript
import { StaffDetailResponse } from '@ybc/api-client';

const instance: StaffDetailResponse = {
    code,
    message,
    data,
};
```

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)
