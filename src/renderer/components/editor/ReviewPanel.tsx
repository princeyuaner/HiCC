import React, { useState, useMemo, useEffect } from 'react';
import { useAppStore } from '../../store/app-store';
import type { ReviewFinding, ReviewResult, ReviewScope } from '../../../shared/types';
import styles from './ReviewPanel.module.css';

const SEVERITY_ORDER: Record<string, number> = {
  critical: 0, high: 1, medium: 2, low: 3, info: 4,
};
const SEVERITY_COLORS: Record<string, string> = {
  critical: 'var(--accent-red)',
  high: 'var(--accent-orange)',
  medium: 'var(--accent-color)',
  low: 'var(--text-muted)',
  info: 'var(--accent-green)',
};
const SEVERITY_ICONS: Record<string, string> = {
  critical: '🔴', high: '🟠', medium: '🟡', low: '🔵', info: '🟢',
};
const GIT_SCOPE_LABELS: Record<ReviewScope, string> = {
  working: 'Working Tree',
  staged: 'Staged Changes',
  head: 'HEAD vs HEAD~1',
  commit: 'Specific Commit',
};
const SVN_SCOPE_LABELS: Record<ReviewScope, string> = {
  working: 'Working Copy',
  staged: 'Working Copy',   // SVN has no staging
  head: 'Last Revision (PREV:HEAD)',
  commit: 'Specific Revision',
};

const ReviewPanel: React.FC = () => {
  const [scope, setScope] = useState<ReviewScope>('working');
  const [commitHash, setCommitHash] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ReviewResult | null>(null);
  const [error, setError] = useState('');
  const [diagnostics, setDiagnostics] = useState('');
  const [filterSeverity, setFilterSeverity] = useState<string>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [collapsedSeverities, setCollapsedSeverities] = useState<Set<string>>(new Set());
  const [expandedFindings, setExpandedFindings] = useState<Set<number>>(new Set());
  const [vcsType, setVcsType] = useState<'git' | 'svn' | null>(null);
  const [vcsChecked, setVcsChecked] = useState(false);

  // Detect VCS type on mount
  useEffect(() => {
    (async () => {
      try {
        await window.hicc.gitStatus();
        setVcsType('git');
      } catch {
        try {
          await window.hicc.svnInfo();
          setVcsType('svn');
        } catch { /* no VCS */ }
      }
      setVcsChecked(true);
    })();
  }, []);

  const scopeLabels = vcsType === 'svn' ? SVN_SCOPE_LABELS : GIT_SCOPE_LABELS;
  const isSvn = vcsType === 'svn';

  const handleStartReview = async () => {
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const r = await window.hicc.reviewCode(scope, scope === 'commit' ? commitHash : undefined);
      setResult(r);
      if (r.diagnostics) setDiagnostics(r.diagnostics);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
    setLoading(false);
  };

  const handleFindingClick = (f: ReviewFinding) => {
    if (!f.file) return;
    const store = useAppStore.getState();
    const name = f.file.split(/[\\/]/).pop() || f.file;
    store.openFile(f.file, name);
    if (f.line > 0) store.focusLine(f.file, f.line);
  };

  const toggleSeverity = (s: string) => {
    setCollapsedSeverities((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next;
    });
  };

  const toggleFindingExpand = (idx: number) => {
    setExpandedFindings((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  // Filter and group findings
  const { groupedFindings, filteredCount } = useMemo(() => {
    if (!result) return { groupedFindings: new Map(), filteredCount: 0 };

    let filtered = result.findings;
    if (filterSeverity !== 'all') {
      filtered = filtered.filter((f) => f.severity === filterSeverity);
    }
    if (filterCategory !== 'all') {
      filtered = filtered.filter((f) => f.category === filterCategory);
    }

    // Sort: severity desc, then file, then line
    filtered = [...filtered].sort((a, b) => {
      const s = (SEVERITY_ORDER[a.severity] ?? 99) - (SEVERITY_ORDER[b.severity] ?? 99);
      if (s !== 0) return s;
      const fc = a.file.localeCompare(b.file);
      if (fc !== 0) return fc;
      return a.line - b.line;
    });

    const groups = new Map<string, ReviewFinding[]>();
    for (const f of filtered) {
      const list = groups.get(f.severity) || [];
      list.push(f);
      groups.set(f.severity, list);
    }

    return { groupedFindings: groups, filteredCount: filtered.length };
  }, [result, filterSeverity, filterCategory]);

  const allCategories = useMemo(() => {
    if (!result) return [];
    return [...new Set(result.findings.map((f) => f.category))].sort();
  }, [result]);

  return (
    <div className={styles.panel}>
      {/* Header */}
      <div className={styles.header}>
        <span className={styles.title}>🔍 Code Review</span>
        {vcsType && (
          <span className={styles.vcsBadge}>
            {vcsType === 'git' ? '🔀 Git' : '🔃 SVN'}
          </span>
        )}
      </div>

      {/* Controls */}
      <div className={styles.controls}>
        <div className={styles.scopeRow}>
          <select
            className={styles.select}
            value={scope}
            onChange={(e) => setScope(e.target.value as ReviewScope)}
          >
            {Object.entries(scopeLabels)
              .filter(([k]) => !isSvn || k !== 'staged') // Hide staged for SVN
              .map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
          </select>
          {scope === 'commit' && (
            <input
              className={styles.commitInput}
              placeholder={isSvn ? 'Revision number...' : 'Commit hash...'}
              value={commitHash}
              onChange={(e) => setCommitHash(e.target.value)}
            />
          )}
        </div>
        <button
          className={styles.startBtn}
          onClick={handleStartReview}
          disabled={loading || (scope === 'commit' && !commitHash.trim())}
        >
          {loading ? 'Analyzing...' : 'Start Review'}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className={styles.errorBanner}>
          <span>❌ {error}</span>
          <button className={styles.dismissBtn} onClick={() => setError('')}>×</button>
        </div>
      )}

      {/* Diagnostics */}
      {diagnostics && (
        <details className={styles.diagDetails}>
          <summary className={styles.diagSummary}>🔧 Diagnostics</summary>
          <pre className={styles.diagPre}>{diagnostics}</pre>
        </details>
      )}

      {/* Loading */}
      {loading && (
        <div className={styles.loading}>
          <span className={styles.spinner}>⏳</span>
          <span>AI is analyzing your changes...</span>
        </div>
      )}

      {/* Results */}
      {result && !loading && (
        <>
          {/* Summary */}
          {result.summary && (
            <div className={styles.summary}>
              <div className={styles.summaryTitle}>Summary</div>
              <div className={styles.summaryText}>{result.summary}</div>
            </div>
          )}

          {/* Stats + Filters */}
          <div className={styles.filterBar}>
            <span className={styles.stat}>
              {filteredCount} finding{filteredCount !== 1 ? 's' : ''}
              {filteredCount !== result.findings.length && (
                <> (filtered from {result.findings.length})</>
              )}
            </span>
            <div className={styles.filterSelects}>
              <select
                className={styles.filterSelect}
                value={filterSeverity}
                onChange={(e) => setFilterSeverity(e.target.value)}
              >
                <option value="all">All Severities</option>
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
                <option value="info">Info</option>
              </select>
              <select
                className={styles.filterSelect}
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
              >
                <option value="all">All Categories</option>
                {allCategories.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Findings grouped by severity */}
          <div className={styles.findingsList}>
            {filteredCount === 0 ? (
              <div className={styles.empty}>No findings match filters</div>
            ) : (
              [...groupedFindings.entries()].map(([severity, findings]) => {
                const isCollapsed = collapsedSeverities.has(severity);
                const color = SEVERITY_COLORS[severity] || 'var(--text-muted)';
                const icon = SEVERITY_ICONS[severity] || '⚪';

                return (
                  <div key={severity} className={styles.severityGroup}>
                    <div
                      className={styles.severityHeader}
                      onClick={() => toggleSeverity(severity)}
                      style={{ color }}
                    >
                      <span className={styles.chevron}>{isCollapsed ? '▶' : '▼'}</span>
                      <span className={styles.severityIcon}>{icon}</span>
                      <span className={styles.severityLabel}>{severity}</span>
                      <span className={styles.severityCount}>{findings.length}</span>
                    </div>
                    {!isCollapsed && (
                      <div className={styles.severityBody}>
                        {findings.map((f, i) => {
                          const globalIdx = result.findings.indexOf(f);
                          const isExpanded = expandedFindings.has(globalIdx);
                          return (
                            <div key={globalIdx} className={styles.findingItem}>
                              <div
                                className={styles.findingHeader}
                                onClick={() => {
                                  toggleFindingExpand(globalIdx);
                                  if (!isExpanded) handleFindingClick(f);
                                }}
                              >
                                <span className={styles.expandIcon}>
                                  {isExpanded ? '▼' : '▶'}
                                </span>
                                <span className={styles.findingTitle}>{f.title}</span>
                                <span className={styles.findingCategory}>{f.category}</span>
                                <span
                                  className={styles.findingLocation}
                                  onClick={(e) => { e.stopPropagation(); handleFindingClick(f); }}
                                >
                                  {f.file.split(/[\\/]/).pop() || f.file}:{f.line}
                                </span>
                              </div>
                              {isExpanded && (
                                <div className={styles.findingDetail}>
                                  <div className={styles.findingFile}>
                                    📄 {f.file}:{f.line}
                                  </div>
                                  <div className={styles.findingDesc}>{f.description}</div>
                                  {f.suggestion && (
                                    <div className={styles.findingSuggestion}>
                                      <span className={styles.suggestionLabel}>💡 Suggestion:</span>
                                      {f.suggestion}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </>
      )}

      {/* Initial state */}
      {!result && !loading && !error && vcsChecked && (
        <div className={styles.empty}>
          <div className={styles.emptyIcon}>🔍</div>
          {vcsType ? (
            <>
              <div className={styles.emptyTitle}>Code Review</div>
              <div className={styles.emptyHint}>
                Select a scope and click "Start Review" to have AI analyze your{' '}
                {vcsType === 'git' ? 'git diff' : 'SVN changes'} for bugs, security issues, and code quality problems.
              </div>
            </>
          ) : (
            <>
              <div className={styles.emptyTitle}>No VCS detected</div>
              <div className={styles.emptyHint}>
                Open a Git or SVN project folder to use AI code review.
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default ReviewPanel;
