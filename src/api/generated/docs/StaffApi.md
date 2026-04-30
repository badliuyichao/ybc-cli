# StaffApi

All URIs are relative to *https://openapi-sit.yonyoucloud.com*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**disableStaff**](#disablestaff) | **POST** /staff/{id}/disable | 禁用员工|
|[**enableStaff**](#enablestaff) | **POST** /staff/{id}/enable | 启用员工|
|[**queryStaff**](#querystaff) | **GET** /yonbip/digitalModel/staff/detail | 查询员工详情|

# **disableStaff**
> StaffEnableResponse disableStaff()

禁用指定 ID 的员工账号

### Example

```typescript
import {
    StaffApi,
    Configuration
} from '@ybc/api-client';

const configuration = new Configuration();
const apiInstance = new StaffApi(configuration);

let id: string; //员工 ID (default to undefined)

const { status, data } = await apiInstance.disableStaff(
    id
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **id** | [**string**] | 员工 ID | defaults to undefined|


### Return type

**StaffEnableResponse**

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | 禁用成功 |  -  |
|**404** | 员工不存在 |  -  |
|**401** | 未授权 |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **enableStaff**
> StaffEnableResponse enableStaff()

启用指定 ID 的员工账号

### Example

```typescript
import {
    StaffApi,
    Configuration
} from '@ybc/api-client';

const configuration = new Configuration();
const apiInstance = new StaffApi(configuration);

let id: string; //员工 ID (default to undefined)

const { status, data } = await apiInstance.enableStaff(
    id
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **id** | [**string**] | 员工 ID | defaults to undefined|


### Return type

**StaffEnableResponse**

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | 启用成功 |  -  |
|**404** | 员工不存在 |  -  |
|**401** | 未授权 |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **queryStaff**
> StaffDetailResponse queryStaff()

查询员工详细信息（简版员工专用）。  **注意**：对于购买了核心人力的客户，请使用\"获取员工详细信息 MDD 接口\"。  id 和 code 至少传其一，用于唯一确定要查询的员工。 

### Example

```typescript
import {
    StaffApi,
    Configuration
} from '@ybc/api-client';

const configuration = new Configuration();
const apiInstance = new StaffApi(configuration);

let id: string; //业务数据 ID（id 和 code 至少传其一） (optional) (default to undefined)
let code: string; //业务数据人员 code（id 和 code 至少传其一） (optional) (default to undefined)

const { status, data } = await apiInstance.queryStaff(
    id,
    code
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **id** | [**string**] | 业务数据 ID（id 和 code 至少传其一） | (optional) defaults to undefined|
| **code** | [**string**] | 业务数据人员 code（id 和 code 至少传其一） | (optional) defaults to undefined|


### Return type

**StaffDetailResponse**

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | 查询成功 |  -  |
|**400** | 请求参数错误 |  -  |
|**401** | 未授权（token 无效或过期） |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

