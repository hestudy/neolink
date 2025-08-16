import { exec } from 'child_process';
import { promisify } from 'util';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';

const execAsync = promisify(exec);

interface BackupOptions {
  outputDir?: string;
  filename?: string;
  compress?: boolean;
  includeData?: boolean;
  includeSchema?: boolean;
}

class DatabaseBackup {
  private connectionString: string;
  private backupDir: string;

  constructor() {
    this.connectionString =
      process.env.DATABASE_URL ||
      'postgresql://neolink:neolink_password@localhost:5432/neolink';
    this.backupDir = join(process.cwd(), 'backups');

    // Ensure backup directory exists
    if (!existsSync(this.backupDir)) {
      mkdirSync(this.backupDir, { recursive: true });
    }
  }

  private generateFilename(options: BackupOptions): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const extension = options.compress ? '.sql.gz' : '.sql';

    if (options.filename) {
      return options.filename.endsWith(extension)
        ? options.filename
        : `${options.filename}${extension}`;
    }

    const type =
      options.includeData && options.includeSchema
        ? 'full'
        : options.includeSchema
          ? 'schema'
          : 'data';

    return `neolink-backup-${type}-${timestamp}${extension}`;
  }

  async createBackup(options: BackupOptions = {}): Promise<string> {
    const {
      outputDir = this.backupDir,
      compress = true,
      includeData = true,
      includeSchema = true,
    } = options;

    const filename = this.generateFilename({
      ...options,
      compress,
      includeData,
      includeSchema,
    });
    const outputPath = join(outputDir, filename);

    console.log(`🔄 Creating database backup: ${filename}`);

    try {
      const pgDumpArgs = [
        '--verbose',
        '--no-password',
        compress ? '--format=custom' : '--format=plain',
      ];

      if (!includeData) {
        pgDumpArgs.push('--schema-only');
      } else if (!includeSchema) {
        pgDumpArgs.push('--data-only');
      }

      if (compress) {
        pgDumpArgs.push('--compress=9');
      }

      pgDumpArgs.push(`--file=${outputPath}`);
      pgDumpArgs.push(this.connectionString);

      const command = `pg_dump ${pgDumpArgs.join(' ')}`;

      console.log(
        `Executing: ${command.replace(this.connectionString, '[CONNECTION_STRING]')}`
      );

      const { stderr } = await execAsync(command);

      if (stderr && !stderr.includes('NOTICE')) {
        console.warn('Backup warnings:', stderr);
      }

      console.log(`✅ Backup created successfully: ${outputPath}`);
      return outputPath;
    } catch (error) {
      console.error(`❌ Backup failed:`, error);
      throw error;
    }
  }

  async restoreBackup(backupPath: string): Promise<void> {
    console.log(`🔄 Restoring database from: ${backupPath}`);

    try {
      const isCompressed =
        backupPath.endsWith('.gz') || backupPath.includes('--format=custom');

      let command: string;

      if (isCompressed) {
        command = `pg_restore --verbose --clean --no-acl --no-owner --dbname=${this.connectionString} ${backupPath}`;
      } else {
        command = `psql ${this.connectionString} < ${backupPath}`;
      }

      console.log(`Executing restore command...`);

      const { stderr } = await execAsync(command);

      if (stderr && !stderr.includes('NOTICE')) {
        console.warn('Restore warnings:', stderr);
      }

      console.log(`✅ Database restored successfully from: ${backupPath}`);
    } catch (error) {
      console.error(`❌ Restore failed:`, error);
      throw error;
    }
  }

  async listBackups(): Promise<string[]> {
    try {
      const { stdout } = await execAsync(
        `ls -la ${this.backupDir}/*.sql* 2>/dev/null || echo ""`
      );

      if (!stdout.trim()) {
        console.log('No backups found');
        return [];
      }

      const backups = stdout
        .trim()
        .split('\n')
        .filter((line) => line.includes('.sql'))
        .map((line) => {
          const parts = line.split(/\s+/);
          return parts[parts.length - 1];
        });

      console.log(`Found ${backups.length} backup(s):`);
      backups.forEach((backup) => console.log(`  - ${backup}`));

      return backups;
    } catch (error) {
      console.error('Failed to list backups:', error);
      return [];
    }
  }

  async scheduleBackup(cronExpression: string): Promise<void> {
    console.log(`Setting up scheduled backup with cron: ${cronExpression}`);
    // This would typically integrate with a cron job or task scheduler
    // For now, we'll just log the intention
    console.log(
      'Note: Implement actual cron scheduling based on your deployment environment'
    );
  }
}

// CLI interface
async function main() {
  const backup = new DatabaseBackup();
  const command = process.argv[2];
  const arg = process.argv[3];

  try {
    switch (command) {
      case 'create':
        await backup.createBackup({
          compress: true,
          includeData: true,
          includeSchema: true,
        });
        break;

      case 'create-schema':
        await backup.createBackup({
          compress: true,
          includeData: false,
          includeSchema: true,
        });
        break;

      case 'create-data':
        await backup.createBackup({
          compress: true,
          includeData: true,
          includeSchema: false,
        });
        break;

      case 'restore':
        if (!arg) {
          console.error('Please provide backup file path');
          process.exit(1);
        }
        await backup.restoreBackup(arg);
        break;

      case 'list':
        await backup.listBackups();
        break;

      default:
        console.log(`
Database Backup Utility

Usage:
  tsx scripts/backup.ts create         - Create full backup (schema + data)
  tsx scripts/backup.ts create-schema  - Create schema-only backup
  tsx scripts/backup.ts create-data    - Create data-only backup
  tsx scripts/backup.ts restore <file> - Restore from backup file
  tsx scripts/backup.ts list           - List available backups
        `);
        break;
    }
  } catch (error) {
    console.error('Command failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export { DatabaseBackup };
