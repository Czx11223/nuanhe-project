// 云端构建入口：同步云函数代码 -> 校验部署产物齐备。
// dist/ 是提交产物（云端不安装 frontend/backend 的依赖），由本地 build.py --frontends 生成。
import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.dirname(fileURLToPath(import.meta.url));

function pickPython() {
  for (const exe of ['python3', 'python', 'py']) {
    if (spawnSync(exe, ['--version'], { stdio: 'ignore' }).status === 0) return exe;
  }
  return null;
}

const py = pickPython();
if (!py) {
  console.error('[X] 未找到 Python 解释器，无法同步云函数');
  process.exit(1);
}
const sync = spawnSync(py, ['build.py'], { cwd: root, stdio: 'inherit' });
if (sync.status !== 0) {
  console.error('[X] 云函数同步失败');
  process.exit(sync.status ?? 1);
}

const required = [
  'dist/index.html',
  'dist/admin/index.html',
  'dist/static',
  'cloud-functions/api/index.py',
  'cloud-functions/app/seed_bundle.py',
  'cloud-functions/requirements.txt',
];
const missing = required.filter((p) => !existsSync(path.join(root, p)));
if (missing.length) {
  console.error('[X] 部署产物缺失：' + missing.join(', '));
  console.error('    请先在本地执行 python build.py --frontends 并提交 dist/');
  process.exit(1);
}
console.log('[OK] 云函数已同步，部署产物齐备（官网 / + 后台 /admin + /api）');
