#!/bin/bash

echo "=========================================="
echo "npm 发布前检查清单"
echo "=========================================="
echo ""

# 检查必要文件
echo "📁 检查必要文件..."
files_ok=true

for file in "package.json" "README.md" "LICENSE" ".npmignore"; do
    if [ -f "$file" ]; then
        echo "  ✅ $file 存在"
    else
        echo "  ❌ $file 缺失"
        files_ok=false
    fi
done

# 检查 dist 目录
echo ""
echo "📦 检查构建产物..."
if [ -d "dist" ] && [ "$(ls -A dist 2>/dev/null)" ]; then
    echo "  ✅ dist 目录存在且包含文件"
    echo "  内容：$(ls dist)"
else
    echo "  ❌ dist 目录不存在或为空"
    echo "  提示：运行 npm run build"
    files_ok=false
fi

# 检查 bin 入口
echo ""
echo "🚀 检查 CLI 入口..."
if [ -f "dist/bin/ybc.js" ]; then
    echo "  ✅ bin 入口存在: dist/bin/ybc.js"
    head -1 dist/bin/ybc.js | grep -q "node" && echo "  ✅ 包含 node shebang" || echo "  ⚠️  缺少 node shebang"
else
    echo "  ❌ bin 入口缺失"
    files_ok=false
fi

# 检查 package.json 配置
echo ""
echo "📋 检查 package.json 配置..."
pkg_name=$(node -p "require('./package.json').name")
pkg_version=$(node -p "require('./package.json').version")
pkg_bin=$(node -p "require('./package.json').bin ? 'yes' : 'no'")

echo "  包名: $pkg_name"
echo "  版本: $pkg_version"
echo "  bin 配置: $pkg_bin"

# 检查 npm 登录状态
echo ""
echo "🔐 检查 npm 登录状态..."
npm whoami >/dev/null 2>&1
if [ $? -eq 0 ]; then
    npm_user=$(npm whoami)
    echo "  ✅ 已登录 npm (用户: $npm_user)"
else
    echo "  ❌ 未登录 npm"
    echo "  提示：运行 npm login"
fi

# 检查包名可用性
echo ""
echo "🔍 检查包名可用性..."
npm view "$pkg_name" >/dev/null 2>&1
if [ $? -eq 0 ]; then
    echo "  ⚠️  包名 $pkg_name 已被占用"
else
    echo "  ✅ 包名 $pkg_name 可用"
fi

echo ""
echo "=========================================="
if [ "$files_ok" = true ]; then
    echo "✅ 项目准备就绪，可以发布！"
    echo ""
    echo "下一步操作："
    echo "  1. npm login              # 登录 npm（如果未登录）"
    echo "  2. npm pack --dry-run     # 预览发布内容"
    echo "  3. npm publish            # 发布到 npm"
else
    echo "❌ 项目尚未准备好发布"
    echo ""
    echo "请先完成："
    echo "  - npm run build           # 构建项目"
    echo "  - npm test                # 运行测试"
fi
echo "=========================================="
