# DeepSeek 网页桌面版 · Windows Fork

> 本项目基于 **[doxdk/deepseek-desktop](https://github.com/doxdk/deepseek-desktop)** 修改，
> 由 [EZdrang](https://github.com/EZdrang) 维护 Windows 增强版本。
> 原项目由 **doxdk（dk）及其贡献者**开发；本分支保留上游提交历史、MIT 许可证和版权声明。

通过 Electron 独立窗口访问 [DeepSeek 官网聊天页面](https://chat.deepseek.com/)，
使用官网账号登录，无需 API Key。本项目是社区网页封装，非 DeepSeek 官方客户端。

## 相对上游的改动

- **系统托盘**：关闭窗口后继续在后台运行；点击托盘图标恢复，右键菜单可彻底退出。
- **Windows 安装向导**：可选安装位置，提供默认勾选的“创建桌面快捷方式”选项。
- **登录状态保存**：移除上游每次加载清空 `localStorage` 的代码，保留网页会话存储。
- **单实例和窗口记忆**：重复启动激活已有窗口，保存窗口大小和位置。
- **中文菜单和连接恢复**：刷新、缩放、快捷键、连接失败提示与重试。
- 更新 Electron 和打包依赖；网页关闭 Node.js 集成，启用上下文隔离与沙箱。

本分支从上游提交 [`b2671ed`](https://github.com/doxdk/deepseek-desktop/commit/b2671ed312891ccc30d369764137e49e9d06d612) 开始修改。
详细来源与改动见 [NOTICE.md](NOTICE.md)。

## 下载

前往本 Fork 的 [Releases](https://github.com/EZdrang/deepseek-desktop/releases)，
下载 `DeepSeek-Desktop-Setup-<版本>-x64.exe`。`Source code` 是源码压缩包，需要自行构建。

## 使用

- Setup EXE：安装版，可选安装位置；安装向导提供“创建桌面快捷方式”复选框，默认勾选。
- 首次启动在官网页面登录；不需要 API Key。Cookies、localStorage 等由 Electron 正常保存。
- 右上角关闭隐藏到右下角托盘，保留后台运行；点击托盘图标恢复窗口。
- 右键托盘菜单可显示、隐藏窗口或彻底退出；重复启动会激活已有窗口。
- 按 Alt 显示菜单；Ctrl+R 刷新，Ctrl+Home 首页，Ctrl+Q 退出。
- 网站功能由 DeepSeek 官网提供。网页改版、服务故障、登录验证可能影响使用。
- 第三方登录链接会交给系统浏览器；请优先使用官网窗口内的手机号等登录方式。
- 文件上传使用官网原生控件，下载会出现保存对话框。外部网页链接用系统浏览器打开。
- 数据目录：%APPDATA%\DeepSeek Web Desktop。升级时保留本机登录状态。
- 从托盘菜单退出应用后，可复制上述整个数据目录做本机备份。
- 社区构建没有商业代码签名，也没有自动更新。

## 开发和构建

构建环境：Windows 10/11 x64，Node.js 24.16 或更高版本。

    git clone https://github.com/EZdrang/deepseek-desktop.git
    cd deepseek-desktop

    npm ci
    npm run setup
    npm test
    npm start
    npm run build

输出目录为 dist/，包含 NSIS 安装包和未打包的程序目录。
`npm test` 运行网址边界测试。可选的桌面运行测试见 [CONTRIBUTING.md](CONTRIBUTING.md)。
开发诊断可设置 `DEEPSEEK_TEST_PROFILE` 使用独立用户数据目录，打包版忽略此变量。

## 反馈与许可证

本分支新增的托盘、安装包和 Windows 行为问题，请在 [本仓库 Issues](https://github.com/EZdrang/deepseek-desktop/issues) 反馈。
DeepSeek 官网的模型、服务和账号问题需联系官网支持。

沿用上游 [MIT 许可证](LICENSE)，保留 `Copyright (c) 2025 dk`。
感谢 [doxdk/deepseek-desktop](https://github.com/doxdk/deepseek-desktop) 提供原始项目。
DeepSeek 名称和标识属于其各自权利人；本项目与 DeepSeek 官方无隶属或背书关系。
