# 员工详情查询 API 文档

> **来源**: 用友 iuap 开放平台
> **发布时间**: 2025-12-22 14:08:52
> **接口 ID**: 57a419ce100a471cb42d25f01a0665c8

---

## 接口说明

此接口为**简版员工专用**，即仅适用于未购买核心人力的客户。

> ⚠️ 对于购买了核心人力的客户，请在 **人力服务 - 员工管理** 目录下，查看"获取员工详细信息 MDD 接口"。

---

## 1. 请求说明

| 字段 | 说明 |
|------|------|
| 请求域名 | 动态域名，获取方式详见《获取租户所在数据中心域名》 |
| 请求地址 | `/yonbip/digitalModel/staff/detail` |
| 请求方式 | `GET` |
| ContentType | — |
| 应用场景 | 开放 API |
| 事务和幂等性 | 无 |

---

## 2. 请求参数

| 名称 | 类型 | 参数位置 | 必填 | 描述 |
|------|------|----------|------|------|
| `access_token` | string | query | **是** | 调用方应用 token（企业自建获取 token / 服务商获取 token） |
| `id` | string | query | 否 | 业务数据 ID |
| `code` | string | query | 否 | 业务数据人员 code |

> 📌 `id` 和 `code` 至少传其一，用于唯一确定要查询的员工。

---

## 3. 请求示例

```
GET /yonbip/digitalModel/staff/detail?access_token=访问令牌&id=&code=
```

---

## 4. 返回值参数

### 4.1 顶层字段

| 名称 | 类型 | 数组 | 描述 |
|------|------|------|------|
| `code` | string | 否 | 返回码，调用成功时返回 `200` |
| `message` | string | 否 | 调用失败时的错误信息 |
| `data` | object | 否 | 调用成功时的返回数据 |

### 4.2 data 对象字段

| 名称 | 类型 | 数组 | 描述 |
|------|------|------|------|
| `enable` | int | 否 | 员工状态：`0` 初始态、`1` 已启用、`2` 已停用 |
| `name` | string | 否 | 员工姓名 |
| `email` | string | 否 | 邮箱 |
| `shop_assis_tag` | string | 否 | 店员标识 |
| `mobile` | string | 否 | 手机号 |
| `code` | string | 否 | 员工编码 |
| `cert_type` | string | 否 | 证件类型 ID |
| `cert_type_name` | string | 否 | 证件类型名称 |
| `cert_no` | string | 否 | 证件号 |
| `photo` | string | 否 | 头像 |
| `ordernumber` | string | 否 | 序号 |
| `officetel` | string | 否 | 办公电话 |
| `sex` | string | 否 | 性别：`1` 男、`2` 女、`0` 不限 |
| `remark` | string | 否 | 备注 |
| `birthdate` | string | 否 | 出生日期 |
| `user_id` | string | 否 | 关联用户 |
| `id` | string | 否 | 员工主键 ID |
| `biz_man_tag` | string | 否 | 业务员标识 |
| `pubts` | string | 否 | 时间戳，格式：`yyyy-MM-dd HH:mm:ss` |
| `account_org_id` | string | 否 | 会计主体 |
| `objid` | string | 否 | 友企联同步主键 |
| `mainJobList` | object | **是** | 员工任职信息（见下表） |
| `ptJobList` | object | **是** | 员工兼职信息（见下表） |
| `bankAcctList` | object | **是** | 员工银行账号（见下表） |

### 4.3 mainJobList / ptJobList（任职/兼职信息）

| 名称 | 类型 | 描述 |
|------|------|------|
| `id` | string | 记录主键 ID |
| `staff_id` | string | 员工 ID |
| `pubts` | string | 时间戳 |
| `org_id` | string | 组织 ID |
| `org_id_name` | string | 组织名称 |
| `dept_id` | string | 部门 ID |
| `dept_id_name` | string | 部门名称 |
| `psncl_id` | string | 人员类别 ID |
| `psncl_id_name` | string | 人员类别名称 |
| `job_id` | string | 职务 ID |
| `job_id_name` | string | 职务名称 |
| `post_id` | string | 岗位 ID |
| `post_id_name` | string | 岗位名称 |
| `jobgrade_id` | string | 职级 ID |
| `jobgrade_id_name` | string | 职级名称 |
| `director` | string | 上级主管 ID |
| `director_name` | string | 上级主管名称 |
| `begindate` | string | 任职开始日期 |
| `enddate` | string | 任职结束日期 |
| `responsibilities` | string | 岗位职责 |
| `dr` | string | 删除标志 |

### 4.4 bankAcctList（银行账号信息）

| 名称 | 类型 | 描述 |
|------|------|------|
| `id` | string | 记录主键 ID |
| `staff_id` | string | 员工 ID |
| `pubts` | string | 时间戳 |
| `account` | string | 银行账号 |
| `accountname` | string | 账户名 |
| `bank` | string | 开户行 ID |
| `bank_name` | string | 开户行名称 |
| `bankname` | string | 银行名称 ID |
| `bankname_name` | string | 银行名称 |
| `currency` | string | 币种 ID |
| `currency_name` | string | 币种名称 |
| `accttype` | string | 账号类型 |
| `isdefault` | string | 是否默认账号 |
| `memo` | string | 备注 |
| `dr` | string | 删除标志 |
| `enable` | string | 启用状态 |

---

## 5. 正确返回示例

```json
{
  "code": "",
  "message": "",
  "data": {
    "enable": 0,
    "name": "",
    "email": "",
    "shop_assis_tag": "",
    "mobile": "",
    "code": "",
    "cert_type": "",
    "photo": "",
    "ordernumber": "",
    "officetel": "",
    "sex": "",
    "remark": "",
    "birthdate": "",
    "user_id": "",
    "id": "",
    "cert_no": "",
    "cert_type_name": "",
    "biz_man_tag": "",
    "pubts": "格式为:yyyy-MM-dd HH:mm:ss",
    "account_org_id": "",
    "objid": "",
    "mainJobList": [
      {
        "id": "",
        "staff_id": "",
        "pubts": "",
        "org_id": "",
        "org_id_name": "",
        "dept_id": "",
        "dept_id_name": "",
        "psncl_id": "",
        "psncl_id_name": "",
        "job_id": "",
        "job_id_name": "",
        "post_id": "",
        "post_id_name": "",
        "jobgrade_id": "",
        "jobgrade_id_name": "",
        "director": "",
        "director_name": "",
        "begindate": "",
        "enddate": "",
        "responsibilities": "",
        "dr": ""
      }
    ],
    "ptJobList": [
      {
        "id": "",
        "staff_id": "",
        "pubts": "",
        "org_id": "",
        "org_id_name": "",
        "dept_id": "",
        "dept_id_name": "",
        "psncl_id": "",
        "psncl_id_name": "",
        "job_id": "",
        "job_id_name": "",
        "post_id": "",
        "post_id_name": "",
        "jobgrade_id": "",
        "jobgrade_id_name": "",
        "director": "",
        "director_name": "",
        "begindate": "",
        "enddate": "",
        "responsibilities": "",
        "dr": ""
      }
    ],
    "bankAcctList": [
      {
        "id": "",
        "staff_id": "",
        "pubts": "",
        "account": "",
        "accountname": "",
        "bank": "",
        "bankname_name": "",
        "bankname": "",
        "bank_name": "",
        "currency": "",
        "accttype": "",
        "currency_name": "",
        "isdefault": "",
        "memo": "",
        "dr": "",
        "enable": ""
      }
    ]
  }
}
```

---

## 6. 业务异常码

暂无业务异常码数据。

---

## 7. 错误返回码

| 错误码 | 错误信息 | 描述 |
|--------|----------|------|
| `999` | 服务端异常 | 联系管理员 |

---

## 9. 接口变更日志

| 序号 | 修改时间 | 变更内容概要 |
|------|----------|-------------|
| 1 | 2025-12-22 | 新增返回参数（5项）；更新返回参数（6项）；返回值中增加特征组 |
| 2 | 2023-11-20 | 新增返回参数 `user_id`，增加 user_id 返回值 |

---

*文档整理时间：2026-04-29*
