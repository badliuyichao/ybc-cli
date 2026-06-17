/**
 * HTTP 模块导出
 *
 * 待办-002（2026-06-17）：移除已废弃的 auth-interceptor 导出
 * 业务请使用 src/services/api/api-http-wrapper.ts 的 ApiHttpWrapper
 */

export { HttpClientFactory, createHttpClientFactory } from './http-client';
export { createLoggingInterceptor } from './logging-interceptor';
