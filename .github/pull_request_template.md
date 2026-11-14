## Summary

请说明这个 PR 改了什么，以及为什么需要它。

## Scope

- [ ] 外壳 / 工作区
- [ ] 编辑器
- [ ] ZIP 导入 / 导出
- [ ] 样式 / 移动端
- [ ] 文档 / CI

## Verification

- [ ] `python -m py_compile serve.py tools/check_repo.py`
- [ ] `python tools/check_repo.py`
- [ ] `node --check` 通过（`sw.js` 与 `src/`）
- [ ] 已补做真实界面回归
- [ ] 涉及导出时，已用 `zipfile` 检查路径与 metadata

## Compatibility / data

是否改变 localStorage 键或结构？是否改变已有资源包路径？如有，请说明迁移或兼容策略。

## Notes

不要附真实用户工作区、个人数据或大体积录屏。界面变化可附最小说明。
