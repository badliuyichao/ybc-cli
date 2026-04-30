# StaffBankAccount

银行账号信息

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**id** | **string** | 记录主键 ID | [optional] [default to undefined]
**staffId** | **string** | 员工 ID | [optional] [default to undefined]
**account** | **string** | 银行账号 | [optional] [default to undefined]
**accountname** | **string** | 账户名 | [optional] [default to undefined]
**bank** | **string** | 开户行 ID | [optional] [default to undefined]
**bankName** | **string** | 开户行名称 | [optional] [default to undefined]
**bankname** | **string** | 银行名称 ID | [optional] [default to undefined]
**banknameName** | **string** | 银行名称 | [optional] [default to undefined]
**currency** | **string** | 币种 ID | [optional] [default to undefined]
**currencyName** | **string** | 币种名称 | [optional] [default to undefined]
**accttype** | **string** | 账号类型 | [optional] [default to undefined]
**isdefault** | **string** | 是否默认账号 | [optional] [default to undefined]
**memo** | **string** | 备注 | [optional] [default to undefined]
**pubts** | **string** | 时间戳 | [optional] [default to undefined]
**dr** | **string** | 删除标志 | [optional] [default to undefined]
**enable** | **string** | 启用状态 | [optional] [default to undefined]

## Example

```typescript
import { StaffBankAccount } from '@ybc/api-client';

const instance: StaffBankAccount = {
    id,
    staffId,
    account,
    accountname,
    bank,
    bankName,
    bankname,
    banknameName,
    currency,
    currencyName,
    accttype,
    isdefault,
    memo,
    pubts,
    dr,
    enable,
};
```

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)
