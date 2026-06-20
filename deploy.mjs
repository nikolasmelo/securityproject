import fs from 'fs';
import path from 'path';

const owner = 'nikolasmelo';
const repo = 'securityproject';
const branch = 'gh-pages';

let token = '';
try {
  const envContent = fs.readFileSync('.env', 'utf8');
  const match = envContent.match(/githubkey=(.*)/);
  if (match) token = match[1].trim();
} catch (e) {
  token = process.env.githubkey || '';
}

const headers = {
  'Authorization': `token ${token}`,
  'Accept': 'application/vnd.github.v3+json',
  'User-Agent': 'DeployScript'
};

async function api(method, endpoint, body) {
  const url = `https://api.github.com/repos/${owner}/${repo}${endpoint}`;
  const response = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });
  if (!response.ok) {
    const errorBody = await response.text();
    if ((response.status === 404 || response.status === 409) && method === 'GET') return null; // allow 404/409 for GET
    throw new Error(`GitHub API error ${response.status} on ${endpoint}: ${errorBody}`);
  }
  return response.json();
}

function getFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const stat = fs.statSync(path.join(dir, file));
    if (stat.isDirectory()) {
      getFiles(path.join(dir, file), fileList);
    } else {
      fileList.push(path.join(dir, file));
    }
  }
  return fileList;
}

async function deploy() {
  console.log('Iniciando o deploy via GitHub API...');
  const distDir = path.join(process.cwd(), 'dist');
  
  if (!fs.existsSync(distDir)) {
    throw new Error('Pasta dist não encontrada. Rode npm run build primeiro.');
  }

  // Obter arquivos
  const files = getFiles(distDir);
  console.log(`Encontrados ${files.length} arquivos para upload.`);

  // Obter ref atual (se existir)
  let baseTreeSha = null;
  const refInfo = await api('GET', `/git/ref/heads/${branch}`);
  
  if (refInfo) {
    const commitInfo = await api('GET', `/git/commits/${refInfo.object.sha}`);
    baseTreeSha = commitInfo.tree.sha;
  } else {
    // Try to check if the repo is completely empty by checking main
    const mainRef = await api('GET', `/git/ref/heads/main`).catch(() => null);
    if (!mainRef) {
       console.log('Repositório vazio. Inicializando com README.md...');
       await api('PUT', '/contents/README.md', {
         message: 'Initial commit',
         content: Buffer.from('# Security Project').toString('base64')
       }).catch(e => console.log('Aviso ao inicializar: ' + e.message));
       await new Promise(r => setTimeout(r, 2000));
    }
  }

  // Criar blobs
  const treeItems = [];
  for (const file of files) {
    const relativePath = path.relative(distDir, file).replace(/\\/g, '/');
    const content = fs.readFileSync(file, { encoding: 'base64' });
    
    console.log(`Fazendo upload: ${relativePath}`);
    const blob = await api('POST', '/git/blobs', {
      content: content,
      encoding: 'base64'
    });
    
    treeItems.push({
      path: relativePath,
      mode: '100644',
      type: 'blob',
      sha: blob.sha
    });
  }

  // Criar árvore
  console.log('Criando nova árvore...');
  const treePayload = { tree: treeItems };
  if (baseTreeSha) treePayload.base_tree = baseTreeSha;
  const treeInfo = await api('POST', '/git/trees', treePayload);

  // Criar commit
  console.log('Criando commit...');
  const commitPayload = {
    message: 'Deploy para GitHub Pages',
    tree: treeInfo.sha
  };
  if (refInfo) commitPayload.parents = [refInfo.object.sha];
  const newCommit = await api('POST', '/git/commits', commitPayload);

  // Atualizar ou criar ref
  if (refInfo) {
    console.log('Atualizando branch gh-pages...');
    await api('PATCH', `/git/refs/heads/${branch}`, {
      sha: newCommit.sha,
      force: true
    });
  } else {
    console.log('Criando branch gh-pages...');
    await api('POST', `/git/refs`, {
      ref: `refs/heads/${branch}`,
      sha: newCommit.sha
    });
  }

  console.log('Deploy concluído com sucesso!');
}

deploy().catch(console.error);
