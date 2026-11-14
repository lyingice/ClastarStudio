# Security Policy

## Supported versions

| Version | Status |
| --- | --- |
| 0.12.x | Supported |
| < 0.12 | Not supported |

## Reporting a vulnerability

请不要在公开 issue 中提交安全漏洞、个人数据或可直接利用的细节。

优先使用 GitHub 的私密安全报告：

<https://github.com/lyingice/ClastarStudio/security/advisories/new>

报告中请包含：

- 受影响版本与浏览器/操作系统
- 复现步骤、影响范围
- 最小化的复现文件（不要包含真实用户工作区或个人信息）
- 建议的修复方向（可选）

维护者会尽量在确认后回复，并在修复发布后致谢（如果你希望署名）。

## Scope

本项目是纯本地静态应用，主要攻击面包括：

- 浏览器端 HTML/CSS/JavaScript
- ZIP 解析与资源包导入
- localStorage 数据读写
- 用户导入的 PNG / JSON / ZIP 文件

本项目没有账号系统、云端接口或远程数据库。部署时不要把无认证的本地服务器直接暴露到公网；局域网使用也建议限制在可信网络。
