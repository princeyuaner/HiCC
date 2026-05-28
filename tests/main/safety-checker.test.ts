import { describe, it, expect } from 'vitest';
import { SafetyChecker } from '../../src/main/services/safety-checker';
import { PERMISSION_LEVEL } from '../../src/shared/constants';

describe('SafetyChecker', () => {
  const checker = new SafetyChecker();

  describe('checkCommand', () => {
    it('blocks rm -rf /', () => {
      const result = checker.checkCommand('rm -rf /');
      expect(result.blocked).toBe(true);
    });

    it('blocks DROP TABLE', () => {
      const result = checker.checkCommand('echo "DROP TABLE users" | mysql');
      expect(result.blocked).toBe(true);
    });

    it('requires approval for npm install', () => {
      const result = checker.checkCommand('npm install lodash');
      expect(result.permissionLevel).toBe(PERMISSION_LEVEL.APPROVE);
      expect(result.blocked).toBe(false);
    });

    it('requires approval for git push', () => {
      const result = checker.checkCommand('git push origin main');
      expect(result.permissionLevel).toBe(PERMISSION_LEVEL.APPROVE);
    });

    it('auto-approves read-only commands', () => {
      const result = checker.checkCommand('git status');
      expect(result.permissionLevel).toBe(PERMISSION_LEVEL.AUTO);
      expect(result.blocked).toBe(false);
    });

    it('auto-approves ls', () => {
      const result = checker.checkCommand('ls -la');
      expect(result.permissionLevel).toBe(PERMISSION_LEVEL.AUTO);
    });
  });

  describe('checkFilePath', () => {
    it('blocks path traversal', () => {
      const result = checker.checkFilePath('../../../etc/passwd', '/project');
      expect(result.blocked).toBe(true);
    });
  });
});
