## @ybc/api-client@1.0.0

This generator creates TypeScript/JavaScript client that utilizes [axios](https://github.com/axios/axios). The generated Node module can be used in the following environments:

Environment
* Node.js
* Webpack
* Browserify

Language level
* ES5 - you must have a Promises/A+ library installed
* ES6

Module system
* CommonJS
* ES6 module system

It can be used in both TypeScript and JavaScript. In TypeScript, the definition will be automatically resolved via `package.json`. ([Reference](https://www.typescriptlang.org/docs/handbook/declaration-files/consumption.html))

### Building

To build and compile the typescript sources to javascript use:
```
npm install
npm run build
```

### Publishing

First build the package then run `npm publish`

### Consuming

navigate to the folder of your consuming project and run one of the following commands.

_published:_

```
npm install @ybc/api-client@1.0.0 --save
```

_unPublished (not recommended):_

```
npm install PATH_TO_GENERATED_PACKAGE --save
```

### Documentation for API Endpoints

All URIs are relative to *https://openapi-sit.yonyoucloud.com*

Class | Method | HTTP request | Description
------------ | ------------- | ------------- | -------------
*StaffApi* | [**disableStaff**](docs/StaffApi.md#disablestaff) | **POST** /staff/{id}/disable | 禁用员工
*StaffApi* | [**enableStaff**](docs/StaffApi.md#enablestaff) | **POST** /staff/{id}/enable | 启用员工
*StaffApi* | [**queryStaff**](docs/StaffApi.md#querystaff) | **GET** /yonbip/digitalModel/staff/detail | 查询员工详情
*TodoApi* | [**createTodo**](docs/TodoApi.md#createtodo) | **POST** /todo/create | 创建待办
*TodoApi* | [**listTodos**](docs/TodoApi.md#listtodos) | **GET** /todo/list | 获取待办列表


### Documentation For Models

 - [ApiResponse](docs/ApiResponse.md)
 - [ErrorResponse](docs/ErrorResponse.md)
 - [Pagination](docs/Pagination.md)
 - [Staff](docs/Staff.md)
 - [StaffBankAccount](docs/StaffBankAccount.md)
 - [StaffDetailResponse](docs/StaffDetailResponse.md)
 - [StaffDetailResponseData](docs/StaffDetailResponseData.md)
 - [StaffEnableResponse](docs/StaffEnableResponse.md)
 - [StaffEnableResponseAllOfData](docs/StaffEnableResponseAllOfData.md)
 - [StaffJobInfo](docs/StaffJobInfo.md)
 - [StaffQueryRequest](docs/StaffQueryRequest.md)
 - [StaffQueryResponse](docs/StaffQueryResponse.md)
 - [StaffQueryResponseAllOfData](docs/StaffQueryResponseAllOfData.md)
 - [Todo](docs/Todo.md)
 - [TodoCreateRequest](docs/TodoCreateRequest.md)
 - [TodoCreateResponse](docs/TodoCreateResponse.md)
 - [TodoListRequest](docs/TodoListRequest.md)
 - [TodoListResponse](docs/TodoListResponse.md)
 - [TodoListResponseAllOfData](docs/TodoListResponseAllOfData.md)


<a id="documentation-for-authorization"></a>
## Documentation For Authorization


Authentication schemes defined for the API:
<a id="bearerAuth"></a>
### bearerAuth

- **Type**: Bearer authentication (JWT)

