cd /home/admin/workspace/autocomplete
npm run compile          # 编译 TypeScript 到 out/
npx @vscode/vsce package # 生成 .vsix
vsce package

code-server --install-extension autocomplete-0.0.1.vsix