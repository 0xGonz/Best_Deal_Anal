/**
 * Production Deployment Validation
 * Comprehensive system validation before production deployment
 */

import { db } from '../server/db';
import { productionAllocationService } from '../server/services/production-allocation.service';
import { productionCapitalCallsService } from '../server/services/production-capital-calls.service';
import { productionConfig } from '../server/config/production.config';

interface ValidationResult {
  category: string;
  test: string;
  status: 'PASS' | 'FAIL' | 'WARN';
  message: string;
  details?: any;
}

class ProductionValidator {
  private results: ValidationResult[] = [];

  async runAllValidations(): Promise<{ passed: number; failed: number; warnings: number; results: ValidationResult[] }> {
    console.log('🔍 Running production deployment validation...');

    // Database validation
    await this.validateDatabaseConnection();
    await this.validateSchemaConsistency();
    await this.validateDataIntegrity();

    // Service validation
    await this.validateAllocationService();
    await this.validateCapitalCallsService();

    // Configuration validation
    await this.validateProductionConfig();

    // Performance validation
    await this.validatePerformance();

    // Security validation
    await this.validateSecurity();

    const passed = this.results.filter(r => r.status === 'PASS').length;
    const failed = this.results.filter(r => r.status === 'FAIL').length;
    const warnings = this.results.filter(r => r.status === 'WARN').length;

    return { passed, failed, warnings, results: this.results };
  }

  private async validateDatabaseConnection(): Promise<void> {
    try {
      await db.execute('SELECT 1');
      this.addResult('Database', 'Connection Test', 'PASS', 'Database connection successful');
    } catch (error) {
      this.addResult('Database', 'Connection Test', 'FAIL', `Database connection failed: ${error}`);
    }
  }

  private async validateSchemaConsistency(): Promise<void> {
    try {
      // Check outstanding_amount consistency
      const inconsistentData = await db.execute(`
        SELECT COUNT(*) as count FROM capital_calls 
        WHERE outstanding_amount::numeric != (call_amount - COALESCE(paid_amount, 0))
      `);

      if (inconsistentData.rows[0].count === '0') {
        this.addResult('Schema', 'Outstanding Amount Consistency', 'PASS', 'All outstanding amounts are correctly calculated');
      } else {
        this.addResult('Schema', 'Outstanding Amount Consistency', 'FAIL', `Found ${inconsistentData.rows[0].count} inconsistent records`);
      }

      // Check required foreign keys
      const orphanedAllocations = await db.execute(`
        SELECT COUNT(*) as count FROM fund_allocations fa 
        LEFT JOIN funds f ON fa.fund_id = f.id 
        LEFT JOIN deals d ON fa.deal_id = d.id 
        WHERE f.id IS NULL OR d.id IS NULL
      `);

      if (orphanedAllocations.rows[0].count === '0') {
        this.addResult('Schema', 'Foreign Key Integrity', 'PASS', 'All foreign key relationships are valid');
      } else {
        this.addResult('Schema', 'Foreign Key Integrity', 'FAIL', `Found ${orphanedAllocations.rows[0].count} orphaned allocations`);
      }

    } catch (error) {
      this.addResult('Schema', 'Consistency Check', 'FAIL', `Schema validation failed: ${error}`);
    }
  }

  private async validateDataIntegrity(): Promise<void> {
    try {
      // Validate allocation status consistency
      const statusInconsistencies = await db.execute(`
        SELECT COUNT(*) as count FROM fund_allocations 
        WHERE (status = 'funded' AND (paid_amount < amount OR paid_amount IS NULL))
           OR (status = 'unfunded' AND paid_amount > 0)
           OR (status = 'partially_paid' AND (paid_amount <= 0 OR paid_amount >= amount))
      `);

      if (statusInconsistencies.rows[0].count === '0') {
        this.addResult('Data', 'Status Consistency', 'PASS', 'All allocation statuses are consistent with payment data');
      } else {
        this.addResult('Data', 'Status Consistency', 'WARN', `Found ${statusInconsistencies.rows[0].count} potentially inconsistent statuses`);
      }

      // Validate portfolio weights sum to 100%
      const weightValidation = await db.execute(`
        SELECT fund_id, SUM(portfolio_weight) as total_weight 
        FROM fund_allocations 
        GROUP BY fund_id 
        HAVING ABS(SUM(portfolio_weight) - 100) > 0.1
      `);

      if (weightValidation.rows.length === 0) {
        this.addResult('Data', 'Portfolio Weight Validation', 'PASS', 'All fund portfolio weights sum to 100%');
      } else {
        this.addResult('Data', 'Portfolio Weight Validation', 'WARN', `${weightValidation.rows.length} funds have incorrect weight totals`);
      }

    } catch (error) {
      this.addResult('Data', 'Integrity Check', 'FAIL', `Data validation failed: ${error}`);
    }
  }

  private async validateAllocationService(): Promise<void> {
    try {
      // Test fund metrics calculation
      const funds = await db.execute('SELECT id FROM funds LIMIT 1');
      if (funds.rows.length > 0) {
        const fundId = parseInt(funds.rows[0].id);
        const metrics = await productionAllocationService.getFundMetrics(fundId);
        
        if (metrics && typeof metrics.totalCommittedCapital === 'number') {
          this.addResult('Service', 'Allocation Service', 'PASS', 'Allocation service functioning correctly');
        } else {
          this.addResult('Service', 'Allocation Service', 'FAIL', 'Allocation service returned invalid data');
        }
      } else {
        this.addResult('Service', 'Allocation Service', 'WARN', 'No funds available for testing');
      }
    } catch (error) {
      this.addResult('Service', 'Allocation Service', 'FAIL', `Allocation service test failed: ${error}`);
    }
  }

  private async validateCapitalCallsService(): Promise<void> {
    try {
      // Test capital calls retrieval
      const allocations = await db.execute('SELECT id FROM fund_allocations LIMIT 1');
      if (allocations.rows.length > 0) {
        const allocationId = parseInt(allocations.rows[0].id);
        const calls = await productionCapitalCallsService.getCapitalCallsForAllocation(allocationId);
        
        if (Array.isArray(calls)) {
          this.addResult('Service', 'Capital Calls Service', 'PASS', 'Capital calls service functioning correctly');
        } else {
          this.addResult('Service', 'Capital Calls Service', 'FAIL', 'Capital calls service returned invalid data');
        }
      } else {
        this.addResult('Service', 'Capital Calls Service', 'WARN', 'No allocations available for testing');
      }
    } catch (error) {
      this.addResult('Service', 'Capital Calls Service', 'FAIL', `Capital calls service test failed: ${error}`);
    }
  }

  private async validateProductionConfig(): Promise<void> {
    const configValidation = productionConfig.validateConfig();
    
    if (configValidation.isValid) {
      this.addResult('Configuration', 'Production Config', 'PASS', 'All configuration values are valid');
    } else {
      this.addResult('Configuration', 'Production Config', 'FAIL', `Configuration errors: ${configValidation.errors.join(', ')}`);
    }

    // Check environment variables
    const requiredEnvVars = ['DATABASE_URL', 'SESSION_SECRET'];
    const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
    
    if (missingVars.length === 0) {
      this.addResult('Configuration', 'Environment Variables', 'PASS', 'All required environment variables are set');
    } else {
      this.addResult('Configuration', 'Environment Variables', 'FAIL', `Missing environment variables: ${missingVars.join(', ')}`);
    }
  }

  private async validatePerformance(): Promise<void> {
    try {
      // Test query performance
      const startTime = Date.now();
      await db.execute(`
        SELECT COUNT(*) FROM fund_allocations fa 
        JOIN funds f ON fa.fund_id = f.id 
        JOIN deals d ON fa.deal_id = d.id
      `);
      const queryTime = Date.now() - startTime;

      if (queryTime < 1000) {
        this.addResult('Performance', 'Query Performance', 'PASS', `Complex join query completed in ${queryTime}ms`);
      } else if (queryTime < 5000) {
        this.addResult('Performance', 'Query Performance', 'WARN', `Complex join query took ${queryTime}ms (consider optimization)`);
      } else {
        this.addResult('Performance', 'Query Performance', 'FAIL', `Complex join query took ${queryTime}ms (too slow for production)`);
      }

      // Check table sizes
      const tableSizes = await db.execute(`
        SELECT 
          table_name,
          pg_size_pretty(pg_total_relation_size(quote_ident(table_name))) as size
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_type = 'BASE TABLE'
        ORDER BY pg_total_relation_size(quote_ident(table_name)) DESC
      `);

      this.addResult('Performance', 'Database Size', 'PASS', `Database contains ${tableSizes.rows.length} tables`, { tableSizes: tableSizes.rows });

    } catch (error) {
      this.addResult('Performance', 'Performance Check', 'FAIL', `Performance validation failed: ${error}`);
    }
  }

  private async validateSecurity(): Promise<void> {
    // Check for sensitive data exposure
    try {
      const auditLogs = await db.execute('SELECT COUNT(*) as count FROM audit_logs');
      
      if (parseInt(auditLogs.rows[0].count) > 0) {
        this.addResult('Security', 'Audit Logging', 'PASS', 'Audit logging is active');
      } else {
        this.addResult('Security', 'Audit Logging', 'WARN', 'No audit logs found - ensure audit system is working');
      }

      // Check session configuration
      const sessionTimeout = productionConfig.security.sessionTimeoutMs;
      if (sessionTimeout > 0 && sessionTimeout <= 86400000) { // Max 24 hours
        this.addResult('Security', 'Session Configuration', 'PASS', `Session timeout configured to ${sessionTimeout / 1000 / 60} minutes`);
      } else {
        this.addResult('Security', 'Session Configuration', 'WARN', 'Session timeout may be too long for production');
      }

    } catch (error) {
      this.addResult('Security', 'Security Check', 'FAIL', `Security validation failed: ${error}`);
    }
  }

  private addResult(category: string, test: string, status: 'PASS' | 'FAIL' | 'WARN', message: string, details?: any): void {
    this.results.push({ category, test, status, message, details });
  }
}

// Execute validation if run directly
if (require.main === module) {
  const validator = new ProductionValidator();
  
  validator.runAllValidations()
    .then(results => {
      console.log('\n=== PRODUCTION DEPLOYMENT VALIDATION RESULTS ===');
      console.log(`✅ Passed: ${results.passed}`);
      console.log(`⚠️  Warnings: ${results.warnings}`);
      console.log(`❌ Failed: ${results.failed}`);
      
      console.log('\n=== DETAILED RESULTS ===');
      results.results.forEach(result => {
        const icon = result.status === 'PASS' ? '✅' : result.status === 'WARN' ? '⚠️' : '❌';
        console.log(`${icon} [${result.category}] ${result.test}: ${result.message}`);
      });

      if (results.failed === 0) {
        console.log('\n🎉 System is ready for production deployment!');
        process.exit(0);
      } else {
        console.log('\n🚨 Fix failed validations before deploying to production');
        process.exit(1);
      }
    })
    .catch(error => {
      console.error('💥 Validation failed:', error);
      process.exit(1);
    });
}

export { ProductionValidator };