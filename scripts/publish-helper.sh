#!/bin/bash

# ========================================
# ybc npm 发布辅助脚本
# ========================================

set -e  # 遇到错误立即退出

PROJECT_NAME="ybc"
CURRENT_VERSION=$(node -p "require('./package.json').version")

echo ""
echo "=========================================="
echo "📦 ybc 发布流程辅助工具"
echo "=========================================="
echo ""
echo "项目名称: $PROJECT_NAME"
echo "当前版本: $CURRENT_VERSION"
echo ""

# 步骤 1：检查登录状态
echo "🔐 步骤 1/6：检查 npm 登录状态..."
if npm whoami &> /dev/null; then
    NPM_USER=$(npm whoami)
    echo "  ✅ 已登录 npm (用户: $NPM_USER)"
else
    echo "  ❌ 未登录 npm"
    echo ""
    echo "请先执行：npm login"
    echo "然后重新运行此脚本"
    exit 1
fi
echo ""

# 步骤 2：检查包名可用性
echo "🔍 步骤 2/6：检查包名可用性..."
if npm view "$PROJECT_NAME" &> /dev/null; then
    EXISTING_VERSION=$(npm view "$PROJECT_NAME" version)
    EXISTING_OWNER=$(npm view "$PROJECT_NAME" owner.name)

    echo "  ⚠️  包名 $PROJECT_NAME 已存在 (版本: $EXISTING_VERSION)"

    if [ "$EXISTING_OWNER" == "$NPM_USER" ]; then
        echo "  ✅ 你是此包的所有者，可以更新版本"
        CAN_PUBLISH=true
    else
        echo "  ❌ 你不是此包的所有者，无法发布"
        echo "  解决方案："
        echo "    - 更换包名"
        echo "    - 或使用 scope: @$NPM_USER/$PROJECT_NAME"
        exit 1
    fi
else
    echo "  ✅ 包名 $PROJECT_NAME 可用（首次发布）"
    CAN_PUBLISH=true
fi
echo ""

# 步骤 3：检查构建产物
echo "📦 步骤 3/6：检查构建产物..."
if [ -d "dist" ] && [ "$(ls -A dist 2>/dev/null)" ]; then
    echo "  ✅ dist 目录存在且包含文件"

    # 检查关键文件
    if [ -f "dist/bin/ybc.js" ]; then
        echo "  ✅ CLI 入口存在: dist/bin/ybc.js"
        if head -1 dist/bin/ybc.js | grep -q "node"; then
            echo "  ✅ 包含 node shebang"
        else
            echo "  ⚠️  缺少 node shebang（可能导致命令无法执行）"
        fi
    else
        echo "  ❌ CLI 入口缺失"
        exit 1
    fi
else
    echo "  ❌ dist 目录不存在或为空"
    echo "  提示：执行 npm run build"
    exit 1
fi
echo ""

# 步骤 4：预览发布内容
echo "📋 步骤 4/6：预览发布内容..."
echo "  执行：npm pack --dry-run"
echo ""
npm pack --dry-run 2>&1 | grep -E "npm notice|Tarball" | head -20
echo ""

# 步骤 5：确认发布
echo "🚀 步骤 5/6：准备发布..."
echo ""
echo "项目已通过所有检查，可以发布！"
echo ""
echo "发布信息："
echo "  - 包名: $PROJECT_NAME"
echo "  - 版本: $CURRENT_VERSION"
echo "  - 用户: $NPM_USER"
echo "  - Registry: $(npm config get registry)"
echo ""

read -p "是否继续发布？(yes/no): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
    echo "取消发布"
    exit 0
fi

echo ""
echo "执行发布..."

# 步骤 6：发布
echo "📤 步骤 6/6：发布到 npm..."

# 判断是否首次发布
if npm view "$PROJECT_NAME" &> /dev/null; then
    # 已有包，更新版本
    npm publish
else
    # 首次发布，指定公开访问
    npm publish --access public
fi

PUBLISH_EXIT_CODE=$?

if [ $PUBLISH_EXIT_CODE -eq 0 ]; then
    echo ""
    echo "=========================================="
    echo "🎉 发布成功！"
    echo "=========================================="
    echo ""
    echo "包已发布到 npm："
    echo "  npm info $PROJECT_NAME"
    echo ""
    echo "其他人可以安装："
    echo "  npm install -g $PROJECT_NAME"
    echo ""
    echo "npm 包页面："
    echo "  https://www.npmjs.com/package/$PROJECT_NAME"
    echo ""
    echo "验证发布："
    npm info "$PROJECT_NAME" | head -15
    echo ""
    echo "=========================================="
else
    echo ""
    echo "❌ 发布失败"
    echo "退出码: $PUBLISH_EXIT_CODE"
    echo ""
    echo "常见原因："
    echo "  - 包名已被占用"
    echo "  - 版本号已存在"
    echo "  - 网络问题"
    echo "  - 权限不足"
    exit 1
fi

echo ""
echo "后续步骤："
echo "  1. npm install -g $PROJECT_NAME  # 全局安装测试"
echo "  2. $PROJECT_NAME --help          # 测试命令"
echo "  3. 创建 Git 标签（如有仓库）"
echo "     git tag v$CURRENT_VERSION"
echo "     git push origin v$CURRENT_VERSION"
echo ""