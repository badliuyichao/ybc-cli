#!/usr/bin/env node
/**
 * CLI 命令自动生成脚本
 *
 * 此脚本从生成的 API 客户端自动生成 CLI 命令封装。
 *
 * 执行步骤：
 * 1. 读取 src/api/generated/api.ts
 * 2. 解析 API 类和方法
 * 3. 为每个 API 方法生成 CLI 命令文件
 * 4. 命令文件位于 src/cli/commands/generated/
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';

// 配置
const API_FILE = join(__dirname, '..', 'src', 'api', 'generated', 'api.ts');
const OUTPUT_DIR = join(__dirname, '..', 'src', 'cli', 'commands', 'generated');

console.log('🚀 开始生成 CLI 命令...\n');

// 步骤 1: 验证 API 文件
console.log('📝 步骤 1: 验证 API 文件');
if (!existsSync(API_FILE)) {
  console.error('❌ 错误: API 文件不存在:', API_FILE);
  console.error('请先运行: npm run generate:api');
  process.exit(1);
}
console.log('✅ API 文件存在:', API_FILE);
console.log();

// 步骤 2: 清理旧的生成文件
console.log('🧹 步骤 2: 清理旧的生成文件');
if (existsSync(OUTPUT_DIR)) {
  console.log('删除旧的生成目录:', OUTPUT_DIR);
  rmSync(OUTPUT_DIR, { recursive: true, force: true });
}
mkdirSync(OUTPUT_DIR, { recursive: true });
console.log('✅ 清理完成');
console.log();

// 步骤 3: 解析 API 文件
console.log('⚙️  步骤 3: 解析 API 文件');

interface ApiMethod {
  name: string;
  summary: string;
  parameters: Array<{
    name: string;
    required: boolean;
    description?: string;
  }>;
  returnType: string;
}

interface ApiClass {
  name: string;
  methods: ApiMethod[];
}

// 解析 API 文件，提取类和方法信息
function parseApiFileSimple(content: string): ApiClass[] {
  const apiClasses: ApiClass[] = [];

  // 查找所有 API 类
  const classNames = ['StaffApi', 'TodoApi'];

  for (const className of classNames) {
    const classStart = content.indexOf(`export class ${className} extends BaseAPI`);
    if (classStart === -1) continue;

    // 找到类的结束位置
    let braceCount = 0;
    let classEnd = classStart;
    let foundFirstBrace = false;

    for (let i = classStart; i < content.length; i++) {
      if (content[i] === '{') {
        braceCount++;
        foundFirstBrace = true;
      } else if (content[i] === '}') {
        braceCount--;
        if (foundFirstBrace && braceCount === 0) {
          classEnd = i;
          break;
        }
      }
    }

    const classBody = content.substring(classStart, classEnd);

    // 提取公共方法
    const methodRegex = /public (\w+)\(([^)]*)\)/g;
    const methods: ApiMethod[] = [];
    let methodMatch;

    while ((methodMatch = methodRegex.exec(classBody)) !== null) {
      const methodName = methodMatch[1];
      const paramsStr = methodMatch[2];

      // 解析参数
      const parameters: ApiMethod['parameters'] = [];
      if (paramsStr.trim()) {
        const paramList = paramsStr.split(',').map(p => p.trim()).filter(p => p);

        for (const param of paramList) {
          const colonIndex = param.indexOf(':');
          if (colonIndex === -1) continue;

          const paramName = param.substring(0, colonIndex).trim().replace('?', '');
          const required = !param.includes('?');

          // 跳过 options 参数
          if (paramName === 'options') continue;

          parameters.push({
            name: paramName,
            required,
          });
        }
      }

      // 从 API 文件中查找方法的 summary 注释
      // 方法：向前搜索到方法定义，然后查找其 JSDoc 注释
      const methodStartInContent = classStart + methodMatch.index;
      const searchStart = Math.max(0, methodStartInContent - 500);
      const beforeMethod = content.substring(searchStart, methodStartInContent);

      // 提取 @summary
      const summaryRegex = /@summary\s+([^\n*]+)/;
      const summaryMatch = summaryRegex.exec(beforeMethod);
      const summary = summaryMatch ? summaryMatch[1].trim() : methodName;

      // 提取返回类型
      const returnRegex = /\)\s*:\s*Promise<([^>]+)>/;
      const returnMatch = returnRegex.exec(classBody.substring(methodMatch.index));
      const returnType = returnMatch ? returnMatch[1] : 'any';

      methods.push({
        name: methodName,
        summary,
        parameters,
        returnType,
      });
    }

    if (methods.length > 0) {
      apiClasses.push({ name: className, methods });
    }
  }

  return apiClasses;
}

const apiContent = readFileSync(API_FILE, 'utf-8');
const apiClasses = parseApiFileSimple(apiContent);

console.log(`✅ 解析完成，发现 ${apiClasses.length} 个 API 类:`);
for (const apiClass of apiClasses) {
  console.log(`  - ${apiClass.name}: ${apiClass.methods.length} 个方法`);
  for (const method of apiClass.methods) {
    console.log(`    • ${method.name}(): ${method.summary}`);
  }
}
console.log();

// 步骤 4: 生成 CLI 命令文件
console.log('📦 步骤 4: 生成 CLI 命令文件');

function generateCommandFile(
  className: string,
  method: ApiMethod
): string {
  // 提取简化的命令名称（去掉重复的域前缀）
  // 例如：queryStaff -> query, enableStaff -> enable, listTodos -> list
  let commandName = method.name;
  const apiName = className.replace(/Api$/, ''); // Staff, Todo

  // 去掉方法名中的域后缀（Staff/Todo）
  // 例如：queryStaff -> query, listTodos -> list
  if (commandName.endsWith(apiName)) {
    commandName = commandName.substring(0, commandName.length - apiName.length);
  }

  // 如果命令名为空或单字符，使用原方法名
  if (!commandName || commandName.length < 2) {
    commandName = method.name;
  }

  const functionName = `register${className}${method.name.charAt(0).toUpperCase() + method.name.slice(1)}Command`;

  // 生成参数选项
  const optionsCode = method.parameters
    .map(param => {
      const flags = param.required ? `<${param.name}>` : `[${param.name}]`;
      return `    .option('--${param.name} ${flags}', '${param.name}')`;
    })
    .join('\n');

  // 生成 API 调用参数
  const argsList = method.parameters.map(p => `options.${p.name}`).join(', ');

  return `/**
 * ${method.summary}
 *
 * 自动生成自 ${className}.${method.name}()
 * 此文件由命令生成器自动生成，请勿手动修改
 */

import { Command } from 'commander';
import { ${className} } from '../../../../api/generated';
import { OutputManager } from '../../../../cli/output';
import { ApiClientService } from '../../../../services/api/api-client-service';

const outputManager = new OutputManager();
const apiClientService = new ApiClientService();

export function ${functionName}(parent: Command) {
  parent
    .command('${commandName}')
    .description('${method.summary}')
${optionsCode || '    // 无参数'}
    .action(async (options) => {
      try {
        // 获取配置好的 API 客户端（使用正确的 gatewayUrl）
        const configuration = await apiClientService.getConfiguration();
        const api = new ${className}(configuration);
        const result = await api.${method.name}(${argsList});

        // 输出结果
        outputManager.output(result.data, options.format);
      } catch (error) {
        console.error('Error:', error);
        process.exit(1);
      }
    });
}
`;
}

function generateIndexFile(
  className: string,
  methods: ApiMethod[]
): string {
  const imports = methods
    .map(
      method =>
        `import { register${className}${method.name.charAt(0).toUpperCase() + method.name.slice(1)}Command } from './${method.name}';`
    )
    .join('\n');

  const registrations = methods
    .map(
      method =>
        `  register${className}${method.name.charAt(0).toUpperCase() + method.name.slice(1)}Command(command);`
    )
    .join('\n');

  return `/**
 * ${className} 命令注册
 *
 * 自动生成自 ${className}
 * 此文件由命令生成器自动生成，请勿手动修改
 */

import { Command } from 'commander';
${imports}

export function register${className}Commands(command: Command) {
${registrations}
}
`;
}

let totalCommands = 0;
for (const apiClass of apiClasses) {
  // 提取域名（去掉 'Api' 后缀并转为小写）
  const domain = apiClass.name.replace(/Api$/, '').toLowerCase();

  // 创建域目录
  const domainDir = join(OUTPUT_DIR, domain);
  mkdirSync(domainDir, { recursive: true });

  // 为每个方法生成命令文件
  for (const method of apiClass.methods) {
    const commandFile = join(domainDir, `${method.name}.ts`);
    const commandCode = generateCommandFile(apiClass.name, method);
    writeFileSync(commandFile, commandCode, 'utf-8');
    console.log(`  ✅ 生成命令: ${domain} ${method.name}`);
    totalCommands++;
  }

  // 生成域的 index 文件
  const indexFile = join(domainDir, 'index.ts');
  const indexCode = generateIndexFile(apiClass.name, apiClass.methods);
  writeFileSync(indexFile, indexCode, 'utf-8');
  console.log(`  ✅ 生成索引: ${domain}/index.ts`);
}

console.log();
console.log('🎉 CLI 命令生成完成！');
console.log(`📁 生成目录: ${OUTPUT_DIR}`);
console.log(`📊 总计: ${apiClasses.length} 个 API 域, ${totalCommands} 个命令`);
console.log();
console.log('下一步:');
console.log('  1. 检查生成的命令: src/cli/commands/generated/');
console.log('  2. 在 src/cli/program.ts 中注册命令');
console.log('  3. 编写单元测试和 E2E 测试');
console.log('  4. 运行 TypeScript 编译测试: npm run build');