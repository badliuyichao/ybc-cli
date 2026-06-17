#!/usr/bin/env node
/**
 * CLI 命令自动生成脚本
 *
 * 此脚本从生成的 API 客户端自动生成 CLI 命令封装。
 *
 * 执行步骤：
 * 1. 读取 src/api/generated/api.ts
 * 2. 从 AxiosParamCreator 块解析每个 API 方法（含 HTTP method / path / 参数）
 * 3. 为每个 API 方法生成 ApiHttpWrapper 模式的 CLI 命令文件
 * 4. 命令文件位于 src/cli/commands/generated/
 *
 * 待办-001（2026-06-17）：模板从旧的 `new XxxApi(configuration)` + `process.exit(1)`
 * 模式改为 `ApiHttpWrapper.call({method, path, params})` + `handleErrorAndExit` 模式。
 * 这样重生成不会再引入 CR-001/CR-041 已修复的问题。
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

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

interface ApiParameter {
  name: string;
  required: boolean;
}

interface ApiMethod {
  name: string;
  summary: string;
  parameters: ApiParameter[];
  returnType: string;
  httpMethod: HttpMethod;
  pathTemplate: string; // 如 `/staff/{id}/enable` 或 `/yonbip/digitalModel/staff/detail`
  pathParams: string[]; // 出现在 path 模板 {x} 中的参数名
  bodyParam?: string; // 请求体参数名（如 todoCreateRequest）
}

interface ApiClass {
  name: string;
  methods: ApiMethod[];
}

const classNames = ['StaffApi', 'TodoApi'];

/**
 * 解析 API 文件，从 AxiosParamCreator 块提取每个方法的完整信息。
 *
 * AxiosParamCreator 每个方法块的固定结构：
 *   methodName: async (params, options): Promise<RequestArgs> => {
 *       const localVarPath = `/staff/{id}/enable`.replace(`{${"id"}}`, ...);
 *       const localVarRequestOptions = { method: 'POST', ...};
 *       localVarRequestOptions.data = serializeDataIfNeeded(todoCreateRequest, ...)
 *   }
 */
function parseApiFileSimple(content: string): ApiClass[] {
  const apiClasses: ApiClass[] = [];

  for (const className of classNames) {
    // 定位 AxiosParamCreator 块范围
    const creatorStart = content.indexOf(`export const ${className}AxiosParamCreator = function`);
    if (creatorStart === -1) continue;
    const classStart = content.indexOf(`export class ${className} extends BaseAPI`);
    const creatorEnd = classStart === -1 ? content.length : classStart;
    const creatorBlock = content.substring(creatorStart, creatorEnd);

    // 在 creator 块内查找所有方法定义
    // 方法签名：methodName: async (...) => {
    const methodSigRegex = /(\w+):\s*async\s*\(([^)]*)\)\s*:\s*Promise<RequestArgs>\s*=>\s*\{/g;
    const methods: ApiMethod[] = [];
    let methodMatch;

    while ((methodMatch = methodSigRegex.exec(creatorBlock)) !== null) {
      const methodName = methodMatch[1];
      const paramsStr = methodMatch[2];
      const methodBodyStart = methodMatch.index! + methodMatch[0].length;
      // 方法体取后续 2500 字符足够覆盖 path/method/data 三处信息
      const methodBody = creatorBlock.substring(methodBodyStart, methodBodyStart + 2500);

      // 解析方法参数（去掉 options）
      const parameters: ApiParameter[] = [];
      if (paramsStr.trim()) {
        const paramList = paramsStr.split(',').map((p) => p.trim()).filter((p) => p);
        for (const param of paramList) {
          const colonIndex = param.indexOf(':');
          if (colonIndex === -1) continue;
          const paramName = param.substring(0, colonIndex).trim().replace('?', '');
          if (paramName === 'options') continue;
          const required = !param.includes('?');
          parameters.push({ name: paramName, required });
        }
      }

      // 提取 @summary（方法注释里有，在 AxiosParamCreator 里方法前有 JSDoc）
      const beforeMethod = creatorBlock.substring(
        Math.max(0, methodMatch.index! - 500),
        methodMatch.index!
      );
      const summaryRegex = /@summary\s+([^\n*]+)/;
      const summaryMatch = summaryRegex.exec(beforeMethod);
      const summary = summaryMatch ? summaryMatch[1].trim() : methodName;

      // 提取 HTTP method
      const methodRegex = /method:\s*'([A-Z]+)'/;
      const methodResult = methodRegex.exec(methodBody);
      const httpMethod = (methodResult?.[1] as HttpMethod) || 'GET';

      // 提取 path 模板：const localVarPath = `xxx`
      const pathRegex = /const localVarPath\s*=\s*`([^`]+)`/;
      const pathResult = pathRegex.exec(methodBody);
      const pathTemplate = pathResult?.[1] || '/';

      // 提取 path 参数：.replace(`{${"X"}}`, ...)
      const pathParams: string[] = [];
      // 用 RegExp 构造函数避免反引号在 TS 模板字符串里被误解析
      const pathParamRegex = new RegExp(String.raw`\.replace\(\`\{\$\{"(\w+)"\}\}\``, 'g');
      let ppm;
      while ((ppm = pathParamRegex.exec(methodBody)) !== null) {
        pathParams.push(ppm[1]);
      }

      // 提取 body 参数：serializeDataIfNeeded(X, ...)
      const bodyRegex = /serializeDataIfNeeded\((\w+),/;
      const bodyResult = bodyRegex.exec(methodBody);
      const bodyParam = bodyResult?.[1];

      // 提取返回类型（从 class body 不再需要，这里保留兼容字段）
      const returnType = 'unknown';

      methods.push({
        name: methodName,
        summary,
        parameters,
        returnType,
        httpMethod,
        pathTemplate,
        pathParams,
        bodyParam,
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
    console.log(
      `    • ${method.name}() [${method.httpMethod} ${method.pathTemplate}]: ${method.summary}`
    );
  }
}
console.log();

// 步骤 4: 生成 CLI 命令文件
console.log('📦 步骤 4: 生成 CLI 命令文件');

/**
 * 把 path 模板中的 {param} 替换为 ${options.param}，返回可放进反引号的字符串字面量。
 * 例：'/staff/{id}/enable' → `/staff/${options.id}/enable`
 */
function buildPathExpression(pathTemplate: string): string {
  if (!/\{(\w+)\}/.test(pathTemplate)) {
    // 无 path 参数，用单引号字符串即可
    return `'${pathTemplate}'`;
  }
  const interpolated = pathTemplate.replace(/\{(\w+)\}/g, '${options.$1}');
  return `\`${interpolated}\``;
}

function generateCommandFile(className: string, method: ApiMethod): string {
  // 提取简化的命令名称（去掉重复的域前缀）
  // 例如：queryStaff -> query, enableStaff -> enable, listTodos -> list
  let commandName = method.name;
  const apiName = className.replace(/Api$/, ''); // Staff, Todo
  if (commandName.endsWith(apiName)) {
    commandName = commandName.substring(0, commandName.length - apiName.length);
  }
  if (!commandName || commandName.length < 2) {
    commandName = method.name;
  }

  const functionName = `register${className}${method.name.charAt(0).toUpperCase() + method.name.slice(1)}Command`;

  // 业务参数 = 签名参数 - path 参数 - body 参数
  const pathParamSet = new Set(method.pathParams);
  const queryParameters = method.parameters.filter(
    (p) => !pathParamSet.has(p.name) && p.name !== method.bodyParam
  );
  const bodyParameter = method.bodyParam
    ? method.parameters.find((p) => p.name === method.bodyParam)
    : undefined;

  // 生成参数选项
  const optionsLines: string[] = [];
  for (const param of method.parameters) {
    const desc = param.name === method.bodyParam ? `${param.name} (JSON 字符串)` : param.name;
    const flags = param.required ? `<${param.name}>` : `[${param.name}]`;
    optionsLines.push(`    .option('--${param.name} ${flags}', '${desc}')`);
  }
  const optionsCode = optionsLines.length > 0 ? optionsLines.join('\n') : '    // 无参数';

  // CR-001:全局选项必须在每个子命令上显式声明
  const globalOptionsCode = `    .option('--format <json|table|csv|raw>', '输出格式')
    .option('--raw', '仅输出服务端原始 JSON')
    .option('--verbose', '输出详细调试日志')`;

  // 构造 path 表达式
  const pathExpr = buildPathExpression(method.pathTemplate);

  // 构造 call() 参数
  const callParts: string[] = [`          method: '${method.httpMethod}'`, `          path: ${pathExpr}`];

  // query 参数 → params 对象
  if (queryParameters.length > 0) {
    const paramLines = queryParameters.map((p) => `            ${p.name}: options.${p.name}`);
    callParts.push(`          params: {\n${paramLines.join(',\n')}\n          }`);
  }

  // body 参数 → JSON.parse
  if (bodyParameter) {
    callParts.push(
      `          body: options.${bodyParameter.name} ? JSON.parse(options.${bodyParameter.name}) : undefined`
    );
  }

  const callArgs = `{\n${callParts.join(',\n')}\n        }`;

  return `/**
 * ${method.summary}
 *
 * 自动生成自 ${className}.${method.name}() （${method.httpMethod} ${method.pathTemplate}）
 * 此文件由命令生成器自动生成，请勿手动修改
 *
 * 待办-001（2026-06-17）：使用 ApiHttpWrapper + handleErrorAndExit 模式
 */

import { Command } from 'commander';
import { ApiHttpWrapper } from '../../../../services/api/api-http-wrapper';
import { OutputManager } from '../../../../cli/output';
import { handleErrorAndExit, BusinessError } from '../../../../services/error';

const outputManager = new OutputManager();

export function ${functionName}(parent: Command) {
  parent
    .command('${commandName}')
    .description('${method.summary}')
${globalOptionsCode}
${optionsCode}
    .action(async (options) => {
      try {
        const wrapper = new ApiHttpWrapper();
        const data = await wrapper.call(${callArgs});

        // CR-016: 统一业务成功码判断
        const responseData = data as { code?: string; message?: string };
        const successCodes = ['200', '00000', 'SUCCESS', ''];
        if (
          responseData.code &&
          !successCodes.includes(responseData.code)
        ) {
          throw new BusinessError(responseData.message || '业务操作失败', {
            businessCode: responseData.code,
          });
        }

        outputManager.output(responseData, options.format);
      } catch (error) {
        handleErrorAndExit(error instanceof Error ? error : new Error(String(error)));
      }
    });
}
`;
}

function generateIndexFile(className: string, methods: ApiMethod[]): string {
  const imports = methods
    .map(
      (method) =>
        `import { register${className}${method.name.charAt(0).toUpperCase() + method.name.slice(1)}Command } from './${method.name}';`
    )
    .join('\n');

  const registrations = methods
    .map(
      (method) =>
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