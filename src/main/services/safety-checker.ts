import { DANGEROUS_COMMAND_PATTERNS, PERMISSION_LEVEL } from '../../shared/constants';

export interface SafetyResult {
  permissionLevel: number;
  blocked: boolean;
  reason?: string;
}

export class SafetyChecker {
  checkFilePath(filePath: string, projectRoot: string): SafetyResult {
    const pathStr = filePath.toLowerCase();

    // Block obvious escape attempts
    if (pathStr.includes('..')) {
      return { permissionLevel: PERMISSION_LEVEL.APPROVE, blocked: true, reason: 'Path traversal detected' };
    }

    return { permissionLevel: PERMISSION_LEVEL.AUTO, blocked: false };
  }

  checkCommand(command: string): SafetyResult {
    // Check against dangerous patterns
    for (const pattern of DANGEROUS_COMMAND_PATTERNS) {
      if (pattern.test(command)) {
        return { permissionLevel: PERMISSION_LEVEL.APPROVE, blocked: true, reason: `Dangerous command pattern detected: ${pattern}` };
      }
    }

    // Commands that modify system state need approval
    const installPatterns = [/npm\s+install/, /pip\s+install/, /yarn\s+add/, /pnpm\s+add/];
    for (const pattern of installPatterns) {
      if (pattern.test(command)) {
        return { permissionLevel: PERMISSION_LEVEL.APPROVE, blocked: false, reason: 'Package installation requires approval' };
      }
    }

    // Git push requires approval
    if (/git\s+push/.test(command)) {
      return { permissionLevel: PERMISSION_LEVEL.APPROVE, blocked: false, reason: 'Git push requires approval' };
    }

    // Read-only commands are auto
    const readOnlyCommands = [/^ls\b/, /^dir\b/, /^cat\b/, /^head\b/, /^tail\b/, /^grep\b/, /^find\b/, /^wc\b/,
      /^git\s+status/, /^git\s+log/, /^git\s+diff/, /^git\s+branch/,
      /^echo\b/, /^pwd\b/, /^which\b/, /^type\b/];
    for (const pattern of readOnlyCommands) {
      if (pattern.test(command)) {
        return { permissionLevel: PERMISSION_LEVEL.AUTO, blocked: false };
      }
    }

    // Other commands need confirmation
    return { permissionLevel: PERMISSION_LEVEL.CONFIRM, blocked: false };
  }
}
