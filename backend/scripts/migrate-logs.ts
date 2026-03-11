import * as fs from 'fs';
import * as path from 'path';

const SRC_DIR = path.join(__dirname, '../src');

function getRelativeImport(fromFile: string): string {
  const fromDir = path.dirname(fromFile);
  let rel = path.relative(fromDir, path.join(SRC_DIR, 'utils/logger'));
  if (!rel.startsWith('.')) rel = './' + rel;
  return rel.replace(/\\/g, '/');
}

function walkDir(dir: string, files: string[] = []): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules') {
        walkDir(fullPath, files);
      }
    } else if (entry.isFile() && entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts')) {
      if (entry.name !== 'logger.ts' && entry.name !== 'migrate-logs.ts') {
        files.push(fullPath);
      }
    }
  }
  return files;
}

const files = walkDir(SRC_DIR);
let totalReplaced = 0;
let filesModified = 0;

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  
  const hasConsoleCalls = /console\.(log|error|warn|debug)\(/.test(content);
  if (!hasConsoleCalls) continue;
  
  // Replace console calls
  const newContent = content
    .replace(/console\.log\(/g, 'logger.info(')
    .replace(/console\.error\(/g, 'logger.error(')
    .replace(/console\.warn\(/g, 'logger.warn(')
    .replace(/console\.debug\(/g, 'logger.debug(');
  
  // Add import if logger is now used but not imported
  const usesLogger = /logger\.(info|error|warn|debug)\(/.test(newContent);
  const hasImport = /import\s+{[^}]*logger[^}]*}\s+from\s+['"].*logger['"]/.test(newContent);
  const hasLoggerImport = /import\s+.*logger.*from/.test(newContent);
  
  let finalContent = newContent;
  if (usesLogger && !hasLoggerImport) {
    const relImport = getRelativeImport(file);
    finalContent = `import { logger } from '${relImport}';\n` + newContent;
  }
  
  if (finalContent !== content) {
    fs.writeFileSync(file, finalContent);
    const count = (content.match(/console\.(log|error|warn|debug)\(/g) || []).length;
    totalReplaced += count;
    filesModified++;
    console.log(`✓ ${path.relative(SRC_DIR, file)}: ${count} replacements`);
  }
}

console.log(`\n✅ Migration complete:`);
console.log(`   Files modified: ${filesModified}`);
console.log(`   Total console calls replaced: ${totalReplaced}`);
