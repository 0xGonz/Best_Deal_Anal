#!/usr/bin/env tsx
/**
 * Deep Code Audit Script - Phase 2
 * 
 * Comprehensive analysis for:
 * 1. Dead/unused code detection
 * 2. Code quality issues
 * 3. Performance bottlenecks
 * 4. Security vulnerabilities
 * 5. TypeScript strict mode violations
 * 6. Unused dependencies
 * 7. Console.log statements in production
 */

import { execSync } from 'child_process';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, extname } from 'path';

interface CodeIssue {
  type: 'dead_code' | 'unused_import' | 'console_log' | 'type_error' | 'performance' | 'security';
  severity: 'critical' | 'high' | 'medium' | 'low';
  file: string;
  line?: number;
  description: string;
  suggestion: string;
}

class DeepCodeAuditor {
  private issues: CodeIssue[] = [];
  private excludedDirs = ['node_modules', '.git', 'dist', 'build', 'coverage'];
  
  async runDeepAudit(): Promise<void> {
    console.log('🔍 Starting deep code audit...\n');
    
    await this.scanForUnusedCode();
    await this.scanForConsoleStatements();
    await this.scanForTypeScriptIssues();
    await this.scanForPerformanceIssues();
    await this.scanForUnusedDependencies();
    await this.scanForSecurityIssues();
    
    this.generateReport();
  }

  private async scanForUnusedCode(): Promise<void> {
    console.log('1️⃣ Scanning for unused code...');
    
    const tsFiles = this.getAllTypeScriptFiles();
    
    for (const file of tsFiles) {
      try {
        const content = readFileSync(file, 'utf8');
        
        // Check for unused imports
        this.checkUnusedImports(file, content);
        
        // Check for unused functions/variables
        this.checkUnusedDeclarations(file, content);
        
        // Check for dead code patterns
        this.checkDeadCodePatterns(file, content);
        
      } catch (error) {
        console.warn(`Warning: Could not analyze ${file}: ${error}`);
      }
    }
  }

  private checkUnusedImports(file: string, content: string): void {
    const lines = content.split('\n');
    const imports: string[] = [];
    const usages = new Set<string>();
    
    lines.forEach((line, index) => {
      // Extract import statements
      const importMatch = line.match(/import\s+(?:{([^}]+)}|\*\s+as\s+(\w+)|(\w+))\s+from/);
      if (importMatch) {
        if (importMatch[1]) {
          // Named imports
          importMatch[1].split(',').forEach(imp => {
            const cleanImport = imp.trim().replace(/\s+as\s+\w+/, '');
            imports.push(cleanImport);
          });
        } else if (importMatch[2] || importMatch[3]) {
          // Default or namespace imports
          imports.push(importMatch[2] || importMatch[3]);
        }
      }
      
      // Track usage patterns
      imports.forEach(imp => {
        if (line.includes(imp) && !line.trim().startsWith('import')) {
          usages.add(imp);
        }
      });
    });
    
    // Find unused imports
    imports.forEach(imp => {
      if (!usages.has(imp)) {
        this.issues.push({
          type: 'unused_import',
          severity: 'low',
          file,
          description: `Unused import: ${imp}`,
          suggestion: `Remove unused import '${imp}'`
        });
      }
    });
  }

  private checkUnusedDeclarations(file: string, content: string): void {
    const lines = content.split('\n');
    
    lines.forEach((line, index) => {
      // Check for unused functions
      const funcMatch = line.match(/(?:function|const|let|var)\s+(\w+)/);
      if (funcMatch && !line.includes('export')) {
        const name = funcMatch[1];
        const usageCount = (content.match(new RegExp(`\\b${name}\\b`, 'g')) || []).length;
        
        if (usageCount === 1) { // Only declaration, no usage
          this.issues.push({
            type: 'dead_code',
            severity: 'medium',
            file,
            line: index + 1,
            description: `Unused declaration: ${name}`,
            suggestion: `Remove unused ${funcMatch[0].includes('function') ? 'function' : 'variable'} '${name}'`
          });
        }
      }
    });
  }

  private checkDeadCodePatterns(file: string, content: string): void {
    const lines = content.split('\n');
    
    lines.forEach((line, index) => {
      const trimmed = line.trim();
      
      // Check for commented out code
      if (trimmed.startsWith('//') && trimmed.length > 20) {
        if (trimmed.includes('function') || trimmed.includes('const') || trimmed.includes('if')) {
          this.issues.push({
            type: 'dead_code',
            severity: 'low',
            file,
            line: index + 1,
            description: 'Commented out code detected',
            suggestion: 'Remove commented code or convert to proper documentation'
          });
        }
      }
      
      // Check for unreachable code after return
      if (trimmed.startsWith('return') && index < lines.length - 1) {
        const nextLine = lines[index + 1].trim();
        if (nextLine && !nextLine.startsWith('}') && !nextLine.startsWith('//')) {
          this.issues.push({
            type: 'dead_code',
            severity: 'medium',
            file,
            line: index + 2,
            description: 'Unreachable code after return statement',
            suggestion: 'Remove code after return statement'
          });
        }
      }
    });
  }

  private async scanForConsoleStatements(): Promise<void> {
    console.log('2️⃣ Scanning for console statements...');
    
    const allFiles = this.getAllTypeScriptFiles();
    
    for (const file of allFiles) {
      const content = readFileSync(file, 'utf8');
      const lines = content.split('\n');
      
      lines.forEach((line, index) => {
        if (line.includes('console.')) {
          const consoleType = line.match(/console\.(\w+)/)?.[1] || 'log';
          
          this.issues.push({
            type: 'console_log',
            severity: consoleType === 'error' ? 'low' : 'medium',
            file,
            line: index + 1,
            description: `Console statement: console.${consoleType}`,
            suggestion: 'Replace with proper logging or remove for production'
          });
        }
      });
    }
  }

  private async scanForTypeScriptIssues(): Promise<void> {
    console.log('3️⃣ Scanning for TypeScript issues...');
    
    try {
      const tscOutput = execSync('cd client && npx tsc --noEmit --strict 2>&1', { encoding: 'utf8' });
      // If no errors, tsc will have empty output
    } catch (error: any) {
      const output = error.stdout || error.message;
      const lines = output.split('\n');
      
      lines.forEach(line => {
        const match = line.match(/(.+?)\((\d+),\d+\):\s*(error|warning)\s*TS\d+:\s*(.+)/);
        if (match) {
          const [, file, lineNum, type, message] = match;
          
          this.issues.push({
            type: 'type_error',
            severity: type === 'error' ? 'high' : 'medium',
            file: file.replace(process.cwd() + '/', ''),
            line: parseInt(lineNum),
            description: `TypeScript ${type}: ${message}`,
            suggestion: 'Fix TypeScript compilation issue'
          });
        }
      });
    }
  }

  private async scanForPerformanceIssues(): Promise<void> {
    console.log('4️⃣ Scanning for performance issues...');
    
    const reactFiles = this.getAllTypeScriptFiles().filter(f => 
      f.includes('/src/') && (f.endsWith('.tsx') || f.endsWith('.jsx'))
    );
    
    for (const file of reactFiles) {
      const content = readFileSync(file, 'utf8');
      const lines = content.split('\n');
      
      lines.forEach((line, index) => {
        // Check for missing React.memo on components
        if (line.includes('export') && line.includes('function') && !content.includes('React.memo')) {
          this.issues.push({
            type: 'performance',
            severity: 'low',
            file,
            line: index + 1,
            description: 'Component not memoized',
            suggestion: 'Consider wrapping with React.memo for performance'
          });
        }
        
        // Check for inline object/function creation in JSX
        if (line.includes('={') || line.includes('={() =>')) {
          this.issues.push({
            type: 'performance',
            severity: 'medium',
            file,
            line: index + 1,
            description: 'Inline object/function creation in render',
            suggestion: 'Move object/function creation outside render or use useCallback/useMemo'
          });
        }
        
        // Check for missing dependency arrays
        if (line.includes('useEffect') && !line.includes('[]') && !content.substring(content.indexOf(line)).includes('], [')) {
          this.issues.push({
            type: 'performance',
            severity: 'high',
            file,
            line: index + 1,
            description: 'useEffect missing dependency array',
            suggestion: 'Add proper dependency array to useEffect'
          });
        }
      });
    }
  }

  private async scanForUnusedDependencies(): Promise<void> {
    console.log('5️⃣ Scanning for unused dependencies...');
    
    try {
      const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));
      const dependencies = Object.keys(packageJson.dependencies || {});
      const devDependencies = Object.keys(packageJson.devDependencies || {});
      
      const allFiles = this.getAllTypeScriptFiles();
      const usedDeps = new Set<string>();
      
      for (const file of allFiles) {
        const content = readFileSync(file, 'utf8');
        
        [...dependencies, ...devDependencies].forEach(dep => {
          if (content.includes(dep)) {
            usedDeps.add(dep);
          }
        });
      }
      
      [...dependencies, ...devDependencies].forEach(dep => {
        if (!usedDeps.has(dep)) {
          this.issues.push({
            type: 'unused_import',
            severity: 'low',
            file: 'package.json',
            description: `Unused dependency: ${dep}`,
            suggestion: `Remove unused dependency '${dep}' from package.json`
          });
        }
      });
      
    } catch (error) {
      console.warn('Could not analyze package.json dependencies');
    }
  }

  private async scanForSecurityIssues(): Promise<void> {
    console.log('6️⃣ Scanning for security issues...');
    
    const allFiles = this.getAllTypeScriptFiles();
    
    for (const file of allFiles) {
      const content = readFileSync(file, 'utf8');
      const lines = content.split('\n');
      
      lines.forEach((line, index) => {
        // Check for potential XSS vulnerabilities
        if (line.includes('dangerouslySetInnerHTML')) {
          this.issues.push({
            type: 'security',
            severity: 'high',
            file,
            line: index + 1,
            description: 'Potential XSS vulnerability with dangerouslySetInnerHTML',
            suggestion: 'Sanitize HTML content or use safer alternatives'
          });
        }
        
        // Check for hardcoded secrets
        if (line.match(/(?:password|secret|key|token)\s*[:=]\s*["'][^"']+["']/i)) {
          this.issues.push({
            type: 'security',
            severity: 'critical',
            file,
            line: index + 1,
            description: 'Potential hardcoded secret',
            suggestion: 'Move secrets to environment variables'
          });
        }
        
        // Check for eval usage
        if (line.includes('eval(')) {
          this.issues.push({
            type: 'security',
            severity: 'critical',
            file,
            line: index + 1,
            description: 'Dangerous eval() usage',
            suggestion: 'Replace eval() with safer alternatives'
          });
        }
      });
    }
  }

  private getAllTypeScriptFiles(): string[] {
    const files: string[] = [];
    
    const scanDirectory = (dir: string): void => {
      try {
        const items = readdirSync(dir);
        
        for (const item of items) {
          const fullPath = join(dir, item);
          
          if (this.excludedDirs.some(excluded => fullPath.includes(excluded))) {
            continue;
          }
          
          const stat = statSync(fullPath);
          
          if (stat.isDirectory()) {
            scanDirectory(fullPath);
          } else if (['.ts', '.tsx', '.js', '.jsx'].includes(extname(fullPath))) {
            files.push(fullPath);
          }
        }
      } catch (error) {
        // Skip directories we can't read
      }
    };
    
    scanDirectory('.');
    return files;
  }

  private generateReport(): void {
    console.log('\n📊 DEEP CODE AUDIT RESULTS\n');
    
    const grouped = this.groupIssuesByType();
    
    Object.entries(grouped).forEach(([type, issues]) => {
      console.log(`\n${this.getTypeIcon(type as any)} ${type.toUpperCase().replace('_', ' ')} (${issues.length} issues)`);
      
      const bySeverity = this.groupBySeverity(issues);
      
      Object.entries(bySeverity).forEach(([severity, severityIssues]) => {
        console.log(`\n  ${this.getSeverityIcon(severity as any)} ${severity.toUpperCase()} (${severityIssues.length})`);
        
        severityIssues.slice(0, 5).forEach(issue => {
          console.log(`    • ${issue.file}${issue.line ? `:${issue.line}` : ''}`);
          console.log(`      ${issue.description}`);
          console.log(`      💡 ${issue.suggestion}\n`);
        });
        
        if (severityIssues.length > 5) {
          console.log(`    ... and ${severityIssues.length - 5} more\n`);
        }
      });
    });
    
    this.generateSummary();
  }

  private groupIssuesByType(): Record<string, CodeIssue[]> {
    return this.issues.reduce((acc, issue) => {
      if (!acc[issue.type]) acc[issue.type] = [];
      acc[issue.type].push(issue);
      return acc;
    }, {} as Record<string, CodeIssue[]>);
  }

  private groupBySeverity(issues: CodeIssue[]): Record<string, CodeIssue[]> {
    return issues.reduce((acc, issue) => {
      if (!acc[issue.severity]) acc[issue.severity] = [];
      acc[issue.severity].push(issue);
      return acc;
    }, {} as Record<string, CodeIssue[]>);
  }

  private getTypeIcon(type: CodeIssue['type']): string {
    const icons = {
      dead_code: '💀',
      unused_import: '📦',
      console_log: '🔍',
      type_error: '🚨',
      performance: '⚡',
      security: '🔒'
    };
    return icons[type] || '❓';
  }

  private getSeverityIcon(severity: CodeIssue['severity']): string {
    const icons = {
      critical: '🔴',
      high: '🟠',
      medium: '🟡',
      low: '🟢'
    };
    return icons[severity] || '⚪';
  }

  private generateSummary(): void {
    const total = this.issues.length;
    const critical = this.issues.filter(i => i.severity === 'critical').length;
    const high = this.issues.filter(i => i.severity === 'high').length;
    const medium = this.issues.filter(i => i.severity === 'medium').length;
    const low = this.issues.filter(i => i.severity === 'low').length;
    
    console.log('\n═══════════════════════════════════════');
    console.log('📋 AUDIT SUMMARY');
    console.log('═══════════════════════════════════════');
    console.log(`Total Issues Found: ${total}`);
    console.log(`🔴 Critical: ${critical}`);
    console.log(`🟠 High: ${high}`);
    console.log(`🟡 Medium: ${medium}`);
    console.log(`🟢 Low: ${low}`);
    
    if (critical > 0) {
      console.log('\n⚠️  CRITICAL ISSUES REQUIRE IMMEDIATE ATTENTION');
    } else if (high > 0) {
      console.log('\n✅ No critical issues, but high priority items need addressing');
    } else {
      console.log('\n🎉 Code quality is good! Only minor improvements needed');
    }
    
    console.log('\n═══════════════════════════════════════\n');
  }
}

// Run the audit
const auditor = new DeepCodeAuditor();
auditor.runDeepAudit().catch(console.error);

export { DeepCodeAuditor };