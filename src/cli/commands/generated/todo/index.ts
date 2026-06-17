/**
 * TodoApi 命令注册
 *
 * 自动生成自 TodoApi
 * 此文件由命令生成器自动生成，请勿手动修改
 *
 * 待办-004（2026-06-17）：ApiClientService 注入
 */

import { Command } from 'commander';
import { ApiClientService } from '../../../../services/api/api-client-service';
import { registerTodoApiCreateTodoCommand } from './createTodo';
import { registerTodoApiListTodosCommand } from './listTodos';

export function registerTodoApiCommands(command: Command, apiClientService: ApiClientService) {
  registerTodoApiCreateTodoCommand(command, apiClientService);
  registerTodoApiListTodosCommand(command, apiClientService);
}
