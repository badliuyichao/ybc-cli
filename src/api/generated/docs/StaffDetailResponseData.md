# StaffDetailResponseData

调用成功时的返回数据

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**id** | **string** | 员工主键 ID | [optional] [default to undefined]
**code** | **string** | 员工编码 | [optional] [default to undefined]
**name** | **string** | 员工姓名 | [optional] [default to undefined]
**enable** | **number** | 员工状态：0 初始态、1 已启用、2 已停用 | [optional] [default to undefined]
**mobile** | **string** | 手机号 | [optional] [default to undefined]
**email** | **string** | 邮箱 | [optional] [default to undefined]
**sex** | **string** | 性别：1 男、2 女、0 不限 | [optional] [default to undefined]
**certType** | **string** | 证件类型 ID | [optional] [default to undefined]
**certTypeName** | **string** | 证件类型名称 | [optional] [default to undefined]
**certNo** | **string** | 证件号 | [optional] [default to undefined]
**photo** | **string** | 头像 | [optional] [default to undefined]
**officetel** | **string** | 办公电话 | [optional] [default to undefined]
**remark** | **string** | 备注 | [optional] [default to undefined]
**birthdate** | **string** | 出生日期 | [optional] [default to undefined]
**userId** | **string** | 关联用户 | [optional] [default to undefined]
**accountOrgId** | **string** | 会计主体 | [optional] [default to undefined]
**bizManTag** | **string** | 业务员标识 | [optional] [default to undefined]
**shopAssisTag** | **string** | 店员标识 | [optional] [default to undefined]
**pubts** | **string** | 时间戳，格式 yyyy-MM-dd HH:mm:ss | [optional] [default to undefined]
**mainJobList** | [**Array&lt;StaffJobInfo&gt;**](StaffJobInfo.md) | 员工任职信息 | [optional] [default to undefined]
**ptJobList** | [**Array&lt;StaffJobInfo&gt;**](StaffJobInfo.md) | 员工兼职信息 | [optional] [default to undefined]
**bankAcctList** | [**Array&lt;StaffBankAccount&gt;**](StaffBankAccount.md) | 员工银行账号 | [optional] [default to undefined]

## Example

```typescript
import { StaffDetailResponseData } from '@ybc/api-client';

const instance: StaffDetailResponseData = {
    id,
    code,
    name,
    enable,
    mobile,
    email,
    sex,
    certType,
    certTypeName,
    certNo,
    photo,
    officetel,
    remark,
    birthdate,
    userId,
    accountOrgId,
    bizManTag,
    shopAssisTag,
    pubts,
    mainJobList,
    ptJobList,
    bankAcctList,
};
```

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)
