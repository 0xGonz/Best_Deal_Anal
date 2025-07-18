#!/usr/bin/env tsx
/**
 * Comprehensive Bug Check and Cleanup Script
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join, extname } from 'path';

interface BugReport {
  file: string;
  line: number;
  type: 'syntax' | 'logic' | 'type' | 'unused';
  description: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  autoFixable: boolean;
}

class ComprehensiveBugChecker {
  private bugs: BugReport[] = [];

  async runComprehensiveCheck(): Promise<void> {
    console.log('🔍 Starting comprehensive bug check...\n');
    
    await this.checkTypeScriptErrors();
    await this.checkSyntaxErrors();
    await this.checkLogicErrors();
    await this.checkUnusedCode();
    
    this.generateBugReport();
  }

  private async checkTypeScriptErrors(): Promise<void> {
    console.log('1️⃣ Checking TypeScript compilation...');
    
    try {
      const { execSync } = await import('child_process');
      const output = execSync('cd client && npx tsc --noEmit 2>&1', { encoding: 'utf8' });
      console.log('✅ TypeScript compilation successful');
    } catch (error: any) {
      const output = error.stdout || error.message;
      const lines = output.split('\n');
      
      lines.forEach(line => {
        const match = line.match(/(.+?)\((\d+),\d+\):\s*(error|warning)\s*TS\d+:\s*(.+)/);
        if (match) {
          const [, file, lineNum, type, message] = match;
          
          this.bugs.push({
            file: file.replace(process.cwd() + '/', ''),
            line: parseInt(lineNum),
            type: 'type',
            description: `TypeScript ${type}: ${message}`,
            severity: type === 'error' ? 'critical' : 'medium',
            autoFixable: message.includes('missing semicolon') || message.includes('expected')
          });
        }
      });
    }
  }

  private async checkSyntaxErrors(): Promise<void> {
    console.log('2️⃣ Checking syntax patterns...');
    
    const files = this.getAllTSFiles();
    
    for (const file of files) {
      try {
        const content = readFileSync(file, 'utf8');
        const lines = content.split('\n');
        
        lines.forEach((line, index) => {
          // Check for broken console log cleanup
          if (line.trim().match(/^\s*(fileName|dealId|documentType|description|endpoint|name|message|stack):\s*/)) {
            this.bugs.push({
              file,
              line: index + 1,
              type: 'syntax',
              description: 'Orphaned object property from console log cleanup',
              severity: 'critical',
              autoFixable: true
            });
          }
          
          // Check for missing semicolons
          if (line.trim().match(/^[^\/\*]*[a-zA-Z0-9\]\)]\s*$/) && !line.includes('//') && !line.includes('{') && !line.includes('}')) {
            this.bugs.push({
              file,
              line: index + 1,
              type: 'syntax',
              description: 'Missing semicolon',
              severity: 'medium',
              autoFixable: true
            });
          }
          
          // Check for broken object literals
          if (line.trim().match(/^[a-zA-Z_][a-zA-Z0-9_]*:\s*/) && !content.includes('interface') && !content.includes('type ')) {
            const prevLine = lines[index - 1]?.trim() || '';
            const nextLine = lines[index + 1]?.trim() || '';
            
            if (!prevLine.includes('{') && !nextLine.includes('}')) {
              this.bugs.push({
                file,
                line: index + 1,
                type: 'syntax',
                description: 'Orphaned object property',
                severity: 'critical',
                autoFixable: true
              });
            }
          }
        });
      } catch (error) {
        console.warn(`⚠️  Could not analyze ${file}`);
      }
    }
  }

  private async checkLogicErrors(): Promise<void> {
    console.log('3️⃣ Checking logic patterns...');
    
    const files = this.getAllTSFiles();
    
    for (const file of files) {
      try {
        const content = readFileSync(file, 'utf8');
        const lines = content.split('\n');
        
        lines.forEach((line, index) => {
          // Check for potential null/undefined access
          if (line.match(/\.\w+/) && !line.includes('?.') && !line.includes('||') && !line.includes('&&')) {
            const beforeDot = line.split('.')[0].trim();
            if (beforeDot.includes('data') || beforeDot.includes('user') || beforeDot.includes('response')) {
              this.bugs.push({
                file,
                line: index + 1,
                type: 'logic',
                description: 'Potential null/undefined access without safety check',
                severity: 'medium',
                autoFixable: false
              });
            }
          }
          
          // Check for missing error handling
          if (line.includes('await fetch') && !content.includes('try') && !content.includes('catch')) {
            this.bugs.push({
              file,
              line: index + 1,
              type: 'logic',
              description: 'Async operation without error handling',
              severity: 'high',
              autoFixable: false
            });
          }
        });
      } catch (error) {
        console.warn(`⚠️  Could not analyze ${file}`);
      }
    }
  }

  private async checkUnusedCode(): Promise<void> {
    console.log('4️⃣ Checking unused code...');
    
    const files = this.getAllTSFiles();
    
    for (const file of files) {
      try {
        const content = readFileSync(file, 'utf8');
        const lines = content.split('\n');
        
        // Check for unused imports
        const imports: string[] = [];
        const usages = new Set<string>();
        
        lines.forEach(line => {
          const importMatch = line.match(/import\s+.*{([^}]+)}.*from/);
          if (importMatch) {
            importMatch[1].split(',').forEach(imp => {
              const cleanImport = imp.trim().replace(/\s+as\s+\w+/, '');
              imports.push(cleanImport);
            });
          }
          
          imports.forEach(imp => {
            if (line.includes(imp) && !line.trim().startsWith('import')) {
              usages.add(imp);
            }
          });
        });
        
        imports.forEach(imp => {
          if (!usages.has(imp)) {
            this.bugs.push({
              file,
              line: 1,
              type: 'unused',
              description: `Unused import: ${imp}`,
              severity: 'low',
              autoFixable: true
            });
          }
        });
      } catch (error) {
        console.warn(`⚠️  Could not analyze ${file}`);
      }
    }
  }

  private getAllTSFiles(): string[] {
    const files: string[] = [];
    const excludedDirs = ['node_modules', '.git', 'dist', 'build', 'coverage'];
    
    const scanDirectory = (dir: string): void => {
      try {
        const items = readdirSync(dir);
        
        for (const item of items) {
          const fullPath = join(dir, item);
          
          if (excludedDirs.some(excluded => fullPath.includes(excluded))) {
            continue;
          }
          
          const stat = statSync(fullPath);
          
          if (stat.isDirectory()) {
            scanDirectory(fullPath);
          } else if (['.ts', '.tsx'].includes(extname(fullPath))) {
            files.push(fullPath);
          }
        }
      } catch (error) {
        // Skip directories we can't read
      }
    };
    
    scanDirectory('client/src');
    return files;
  }

  private generateBugReport(): void {
    console.log('\n📊 COMPREHENSIVE BUG REPORT\n');
    
    const critical = this.bugs.filter(b => b.severity === 'critical');
    const high = this.bugs.filter(b => b.severity === 'high');
    const medium = this.bugs.filter(b => b.severity === 'medium');
    const low = this.bugs.filter(b => b.severity === 'low');
    
    console.log(`🔴 CRITICAL ISSUES (${critical.length})`);
    critical.slice(0, 10).forEach(bug => {
      console.log(`  • ${bug.file}:${bug.line} - ${bug.description}`);
    });
    
    console.log(`\n🟠 HIGH PRIORITY (${high.length})`);
    high.slice(0, 5).forEach(bug => {
      console.log(`  • ${bug.file}:${bug.line} - ${bug.description}`);
    });
    
    console.log(`\n🟡 MEDIUM PRIORITY (${medium.length})`);
    medium.slice(0, 5).forEach(bug => {
      console.log(`  • ${bug.file}:${bug.line} - ${bug.description}`);
    });
    
    console.log(`\n🟢 LOW PRIORITY (${low.length})`);
    low.slice(0, 3).forEach(bug => {
      console.log(`  • ${bug.file}:${bug.line} - ${bug.description}`);
    });
    
    const autoFixable = this.bugs.filter(b => b.autoFixable).length;
    console.log(`\n🔧 AUTO-FIXABLE: ${autoFixable}/${this.bugs.length} issues can be automatically resolved`);
    
    if (critical.length === 0) {
      console.log('\n✅ No critical issues found! Application should be stable.');
    } else {
      console.log('\n⚠️  Critical issues require immediate attention to prevent runtime failures.');
    }
  }
}

// Run the comprehensive check
const checker = new ComprehensiveBugChecker();
checker.runComprehensiveCheck().catch(console.error);