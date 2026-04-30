/**
 * TodoApi 命令注册
 *
 * 自动生成自 TodoApi
 * 此文件由命令生成器自动生成，请勿手动修改
 */

import { Command } from 'commander';
import { registerTodoApiCreateTodoCommand } from './createTodo';
import { registerTodoApiListTodosCommand } from './listTodos';

export function registerTodoApiCommands(command: Command) {
  registerTodoApiCreateTodoCommand(command);
  registerTodoApiListTodosCommand(command);
}
