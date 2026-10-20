# 参与本 Fork

本仓库是 [doxdk/deepseek-desktop](https://github.com/doxdk/deepseek-desktop) 的 Windows 增强 Fork。
提交修改时请保留上游署名、MIT 许可证和提交历史。

## 本地开发

在 Windows x64 上使用 Node.js 24.16 或更高版本：

```powershell
npm ci
npm run setup
npm test
npm start
```

`npm run build` 生成安装包，`npm run build:dir` 只生成可运行目录。
依赖版本由 `package-lock.json` 锁定。打包前请退出正在运行的开发版。

## 可选桌面测试

这些脚本需要 Windows 桌面会话、Electron 运行时和可访问 DeepSeek 官网的网络。
它们使用隔离的测试数据目录。不要向测试窗口输入真实账号、密码或聊天内容。

```powershell
node tests/runtime-smoke.cjs
```

原生托盘测试请让同一组写入/读取测试使用相同的临时数据目录：

```powershell
$env:DEEPSEEK_TEST_PROFILE = Join-Path $env:TEMP ([guid]::NewGuid().ToString())
$env:DEEPSEEK_TRAY_PHASE = 'write'
Start-Process .\node_modules\electron\dist\electron.exe -ArgumentList 'tests\native-tray.cjs' -Wait
$env:DEEPSEEK_TRAY_PHASE = 'read'
Start-Process .\node_modules\electron\dist\electron.exe -ArgumentList 'tests\native-tray.cjs' -Wait
Remove-Item Env:DEEPSEEK_TEST_PROFILE, Env:DEEPSEEK_TRAY_PHASE
```

测试包括关闭到托盘、图标恢复、重复启动、显式退出及网页存储保留。
源码测试脚本不支持直接测试打包后的 EXE，避免误用日常登录数据。

## 提交范围

- 欢迎 Windows 窗口、托盘、安装流程和构建问题的修复。
- 网页内容、聊天功能和模型由 DeepSeek 官网提供。
- 提交前运行 `npm test`；修改窗口生命周期或安装器时补充相应的 Windows 验证结果。
- 不要提交登录数据、Cookies、聊天截图、访问令牌、个人配置或 `node_modules`、`dist` 等生成文件。
