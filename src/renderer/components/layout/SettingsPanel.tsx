import React, { useState, useEffect } from 'react';
import { useAppStore, selectActiveProfile, selectIsConfigured } from '../../store/app-store';
import type { ApiProfile } from '../../types';

const labelStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  fontSize: 12,
  color: 'var(--text-secondary)',
};

const inputStyle: React.CSSProperties = {
  padding: '6px 10px',
  borderRadius: 4,
  border: '1px solid var(--border-color)',
  background: 'var(--bg-primary)',
  color: 'var(--text-primary)',
  fontSize: 13,
  fontFamily: 'var(--font-family)',
};

const buttonPrimaryStyle: React.CSSProperties = {
  padding: '6px 16px',
  borderRadius: 6,
  border: 'none',
  background: 'var(--accent-color)',
  color: '#fff',
  cursor: 'pointer',
  fontSize: 13,
};

const buttonSecondaryStyle: React.CSSProperties = {
  padding: '6px 16px',
  borderRadius: 6,
  border: '1px solid var(--border-color)',
  background: 'transparent',
  color: 'var(--text-primary)',
  cursor: 'pointer',
  fontSize: 13,
};

const smallSecondaryStyle: React.CSSProperties = {
  ...buttonSecondaryStyle,
  padding: '2px 8px',
  fontSize: 11,
};

const SettingsPanel: React.FC = () => {
  const setActiveSidebar = useAppStore((s) => s.setActiveSidebar);
  const close = () => setActiveSidebar(null);
  const [activeTab, setActiveTab] = useState<'profiles' | 'mcp' | 'models' | 'general'>('profiles');
  const profiles = useAppStore((s) => s.profiles);
  const activeProfileId = useAppStore((s) => s.activeProfileId);
  const setActiveProfileId = useAppStore((s) => s.setActiveProfileId);
  const addProfile = useAppStore((s) => s.addProfile);
  const updateProfileInStore = useAppStore((s) => s.updateProfileInStore);
  const removeProfile = useAppStore((s) => s.removeProfile);
  const isConfigured = useAppStore(selectIsConfigured);
  const [editingProfile, setEditingProfile] = useState<ApiProfile | null>(null);
  const [isAddingProfile, setIsAddingProfile] = useState(false);

  const [formName, setFormName] = useState('');
  const [formBaseUrl, setFormBaseUrl] = useState('');
  const [formApiKey, setFormApiKey] = useState('');
  const [formSonnetModel, setFormSonnetModel] = useState('');
  const [formOpusModel, setFormOpusModel] = useState('');
  const [formSmallFastModel, setFormSmallFastModel] = useState('');
  const [formSystemPrompt, setFormSystemPrompt] = useState('');
  const [formTemperature, setFormTemperature] = useState('');
  const [formMaxTokens, setFormMaxTokens] = useState('');
  const [formThinkingEnabled, setFormThinkingEnabled] = useState(true);
  const [formThinkingBudget, setFormThinkingBudget] = useState('');

  // MCP state
  const [mcpServers, setMcpServers] = useState<Record<string, Record<string, unknown>>>({});
  const [editingMcp, setEditingMcp] = useState<string | null>(null);
  const [isAddingMcp, setIsAddingMcp] = useState(false);
  const [mcpName, setMcpName] = useState('');
  const [mcpType, setMcpType] = useState<'stdio' | 'sse' | 'http'>('stdio');
  const [mcpCommand, setMcpCommand] = useState('');
  const [mcpArgs, setMcpArgs] = useState('');
  const [mcpUrl, setMcpUrl] = useState('');
  const [mcpEnv, setMcpEnv] = useState('');

  useEffect(() => {
    window.hicc.getMcpServers().then((s) => setMcpServers(s as unknown as Record<string, Record<string, unknown>>)).catch(() => {});
  }, []);

  const startEdit = (profile: ApiProfile) => {
    setFormName(profile.name);
    setFormBaseUrl(profile.baseUrl);
    setFormApiKey(profile.apiKey);
    setFormSonnetModel(profile.sonnetModel || profile.model || '');
    setFormOpusModel(profile.opusModel || profile.model || '');
    setFormSmallFastModel(profile.smallFastModel || profile.model || '');
    setFormSystemPrompt(profile.systemPrompt || '');
    setFormTemperature(profile.temperature?.toString() || '');
    setFormMaxTokens(profile.maxTokens?.toString() || '');
    setFormThinkingEnabled(profile.thinkingEnabled !== false);
    setFormThinkingBudget(profile.thinkingBudget?.toString() || '');
    setEditingProfile(profile);
    setIsAddingProfile(false);
  };

  const startAdd = () => {
    setFormName('');
    setFormBaseUrl('');
    setFormApiKey('');
    setFormSonnetModel('');
    setFormOpusModel('');
    setFormSmallFastModel('');
    setFormSystemPrompt('');
    setFormTemperature('');
    setFormMaxTokens('');
    setFormThinkingEnabled(true);
    setFormThinkingBudget('');
    setEditingProfile(null);
    setIsAddingProfile(true);
  };

  const cancelEdit = () => {
    setEditingProfile(null);
    setIsAddingProfile(false);
  };

  const saveProfile = async () => {
    if (!formName.trim()) return;

    if (isAddingProfile) {
      const profile = await window.hicc.createProfile(formName.trim());
      const updated: ApiProfile = {
        ...profile,
        baseUrl: formBaseUrl,
        apiKey: formApiKey,
        model: formSonnetModel || 'claude-sonnet-4-6',
        sonnetModel: formSonnetModel,
        opusModel: formOpusModel,
        smallFastModel: formSmallFastModel,
        systemPrompt: formSystemPrompt,
        temperature: formTemperature ? parseFloat(formTemperature) : undefined,
        maxTokens: formMaxTokens ? parseInt(formMaxTokens) : undefined,
        thinkingEnabled: formThinkingEnabled,
        thinkingBudget: formThinkingBudget ? parseInt(formThinkingBudget) : undefined,
      };
      await window.hicc.updateProfile(updated);
      addProfile(updated);
      if (profiles.length === 0) {
        setActiveProfileId(updated.id);
      }
    } else if (editingProfile) {
      const updated: ApiProfile = {
        ...editingProfile,
        name: formName.trim(),
        baseUrl: formBaseUrl,
        apiKey: formApiKey,
        model: formSonnetModel || 'claude-sonnet-4-6',
        sonnetModel: formSonnetModel,
        opusModel: formOpusModel,
        smallFastModel: formSmallFastModel,
        systemPrompt: formSystemPrompt,
        temperature: formTemperature ? parseFloat(formTemperature) : undefined,
        maxTokens: formMaxTokens ? parseInt(formMaxTokens) : undefined,
        thinkingEnabled: formThinkingEnabled,
        thinkingBudget: formThinkingBudget ? parseInt(formThinkingBudget) : undefined,
      };
      await window.hicc.updateProfile(updated);
      updateProfileInStore(updated);
    }
    cancelEdit();
  };

  // MCP handlers
  const startAddMcp = () => {
    setMcpName('');
    setMcpType('stdio');
    setMcpCommand('');
    setMcpArgs('');
    setMcpUrl('');
    setMcpEnv('');
    setEditingMcp(null);
    setIsAddingMcp(true);
  };

  const startEditMcp = (name: string, config: Record<string, unknown>) => {
    setMcpName(name);
    setMcpType((config.type as 'stdio' | 'sse' | 'http') || 'stdio');
    if ((config.type || 'stdio') === 'stdio') {
      setMcpType('stdio');
      setMcpCommand((config.command as string) || '');
      setMcpArgs(((config.args as string[]) || []).join(' '));
      setMcpUrl('');
      setMcpEnv(config.env ? Object.entries(config.env as Record<string, string>).map(([k, v]) => `${k}=${v}`).join('\n') : '');
    } else {
      setMcpType(config.type as 'sse' | 'http' || 'sse');
      setMcpUrl((config.url as string) || '');
      setMcpCommand('');
      setMcpArgs('');
      setMcpEnv('');
    }
    setEditingMcp(name);
    setIsAddingMcp(false);
  };

  const saveMcp = async () => {
    if (!mcpName.trim()) return;
    const config: Record<string, unknown> = {};
    if (mcpType === 'stdio') {
      config.type = 'stdio';
      config.command = mcpCommand.trim();
      if (mcpArgs.trim()) config.args = mcpArgs.trim().split(/\s+/);
      if (mcpEnv.trim()) {
        const env: Record<string, string> = {};
        mcpEnv.trim().split('\n').forEach((line) => {
          const [k, ...v] = line.split('=');
          if (k) env[k.trim()] = v.join('=').trim();
        });
        if (Object.keys(env).length > 0) config.env = env;
      }
    } else {
      config.type = mcpType;
      config.url = mcpUrl.trim();
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updated: Record<string, any> = { ...mcpServers, [mcpName.trim()]: config };
    setMcpServers(updated);
    await window.hicc.saveMcpServers(updated);
    // Restart session to pick up new MCP tools
    try { await window.hicc.interrupt(); } catch { /* ignore */ }
    const { activeModelKey, permissionMode, effortLevel } = useAppStore.getState();
    window.hicc.startSession(activeModelKey, permissionMode, effortLevel).catch(console.error);
    setIsAddingMcp(false);
    setEditingMcp(null);
  };

  const deleteMcp = async (name: string) => {
    const { [name]: _, ...rest } = mcpServers;
    setMcpServers(rest);
    await window.hicc.saveMcpServers(rest);
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      {/* Backdrop */}
      <div onClick={close} style={{
        position: 'absolute', inset: 0,
        background: 'rgba(0,0,0,0.5)',
      }} />
      {/* Modal */}
      <div style={{
        position: 'relative',
        width: 700, maxWidth: '90vw', height: 520, maxHeight: '85vh',
        display: 'flex', background: 'var(--bg-primary)',
        borderRadius: 10, border: '1px solid var(--border-color)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        overflow: 'hidden',
      }}>
        {/* Close button */}
        <button onClick={close} style={{
          position: 'absolute', top: 8, right: 12, zIndex: 10,
          border: 'none', background: 'transparent',
          color: 'var(--text-secondary)', cursor: 'pointer',
          fontSize: 20, lineHeight: 1,
        }}>×</button>
        <div style={{ height: '100%', display: 'flex', background: 'var(--bg-primary)', flex: 1 }}>
      {/* Vertical tab bar */}
      <div style={{ width: 100, borderRight: '1px solid var(--border-color)', background: 'var(--bg-secondary)', display: 'flex', flexDirection: 'column', paddingTop: 4 }}>
        {[
          { key: 'profiles' as const, label: 'Profiles' },
          { key: 'mcp' as const, label: 'MCP' },
          { key: 'models' as const, label: 'Models' },
          { key: 'general' as const, label: 'General' },
        ].map((tab) => (
          <div
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              padding: '8px 12px',
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: activeTab === tab.key ? 600 : 400,
              color: activeTab === tab.key ? 'var(--accent-color)' : 'var(--text-secondary)',
              background: activeTab === tab.key ? 'color-mix(in srgb, var(--accent-color) 10%, transparent)' : 'transparent',
              borderLeft: activeTab === tab.key ? '2px solid var(--accent-color)' : '2px solid transparent',
              transition: 'color 0.15s, background 0.15s',
            }}
          >
            {tab.label}
          </div>
        ))}
      </div>
      {/* Content area */}
      <div style={{ flex: 1, overflow: 'auto', padding: 12 }}>
        {activeTab === 'profiles' && (<>
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>
            API Profiles
          </div>
          {profiles.map((profile) => {
            const isActive = profile.id === activeProfileId;
            return (
              <div
                key={profile.id}
                onClick={() => setActiveProfileId(profile.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 10px',
                  marginBottom: 4,
                  borderRadius: 6,
                  cursor: 'pointer',
                  background: isActive ? 'color-mix(in srgb, var(--accent-color) 15%, transparent)' : 'var(--bg-secondary)',
                  border: isActive ? '1px solid var(--accent-color)' : '1px solid transparent',
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: isActive ? 600 : 400, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {profile.name} {isActive && '(active)'}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {profile.baseUrl || 'Default API'}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                  <button onClick={(e) => { e.stopPropagation(); startEdit(profile); }} style={smallSecondaryStyle}>Edit</button>
                  <button onClick={(e) => { e.stopPropagation(); removeProfile(profile.id); }} style={{ ...smallSecondaryStyle, color: '#f44336', borderColor: 'rgba(244,67,54,0.4)' }}>Del</button>
                </div>
              </div>
            );
          })}
          {profiles.length === 0 && (
            <div style={{ padding: 12, fontSize: 12, color: 'var(--text-secondary)', textAlign: 'center' }}>
              No profiles. Add one to get started.
            </div>
          )}
          <button onClick={startAdd} style={{ ...buttonSecondaryStyle, marginTop: 8, width: '100%' }}>
            + Add Profile
          </button>
        </div>

        {/* Edit/Create Form */}
        {(isAddingProfile || editingProfile) && (
          <div style={{ padding: 12, background: 'var(--bg-secondary)', borderRadius: 8, border: '1px solid var(--border-color)' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 12 }}>
              {isAddingProfile ? 'New Profile' : `Edit: ${editingProfile?.name}`}
            </div>
            <label style={labelStyle}>
              Profile Name
              <input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="My Profile" style={inputStyle} />
            </label>
            <label style={{ ...labelStyle, marginTop: 8 }}>
              Base URL
              <input value={formBaseUrl} onChange={(e) => setFormBaseUrl(e.target.value)} placeholder="https://api.anthropic.com" style={inputStyle} />
            </label>
            <label style={{ ...labelStyle, marginTop: 8 }}>
              API Key
              <input value={formApiKey} onChange={(e) => setFormApiKey(e.target.value)} type="password" placeholder="sk-ant-..." style={inputStyle} />
            </label>
            <label style={{ ...labelStyle, marginTop: 8 }}>
              Sonnet Model
              <input value={formSonnetModel} onChange={(e) => setFormSonnetModel(e.target.value)} placeholder="claude-sonnet-4-6" style={inputStyle} />
            </label>
            <label style={{ ...labelStyle, marginTop: 8 }}>
              Opus Model
              <input value={formOpusModel} onChange={(e) => setFormOpusModel(e.target.value)} placeholder="claude-opus-4-7" style={inputStyle} />
            </label>
            <label style={{ ...labelStyle, marginTop: 8 }}>
              Haiku / Small Model
              <input value={formSmallFastModel} onChange={(e) => setFormSmallFastModel(e.target.value)} placeholder="claude-haiku-4-5" style={inputStyle} />
            </label>
            <label style={{ ...labelStyle, marginTop: 8 }}>
              System Prompt (optional)
              <textarea value={formSystemPrompt} onChange={(e) => setFormSystemPrompt(e.target.value)} placeholder="Custom instructions..." rows={4} style={{ ...inputStyle, resize: 'vertical' }} />
            </label>
            <label style={{ ...labelStyle, marginTop: 8 }}>
              Temperature (0.0 - 1.0)
              <input type="number" value={formTemperature} onChange={(e) => setFormTemperature(e.target.value)} placeholder="e.g. 0.7" min="0" max="1" step="0.1" style={inputStyle} />
            </label>
            <label style={{ ...labelStyle, marginTop: 8 }}>
              Max Output Tokens
              <input type="number" value={formMaxTokens} onChange={(e) => setFormMaxTokens(e.target.value)} placeholder="e.g. 8192" min="1" style={inputStyle} />
            </label>
            <label style={{ ...labelStyle, marginTop: 8, display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <input type="checkbox" checked={formThinkingEnabled} onChange={(e) => setFormThinkingEnabled(e.target.checked)} />
              Enable Extended Thinking
            </label>
            {formThinkingEnabled && (
              <label style={{ ...labelStyle, marginTop: 8 }}>
                Thinking Token Budget
                <input type="number" value={formThinkingBudget} onChange={(e) => setFormThinkingBudget(e.target.value)} placeholder="e.g. 4000 (empty for adaptive)" min="1024" style={inputStyle} />
              </label>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
              <button onClick={cancelEdit} style={buttonSecondaryStyle}>Cancel</button>
              <button onClick={saveProfile} style={buttonPrimaryStyle}>Save</button>
            </div>
          </div>
        )}
        </>)}
        {activeTab === 'mcp' && (<>
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>
              MCP Servers
            </div>
            {Object.entries(mcpServers).map(([name, config]) => (
              <div
                key={name}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '6px 10px',
                  marginBottom: 4,
                  borderRadius: 6,
                  background: 'var(--bg-secondary)',
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {'command' in config ? `stdio: ${config.command}` : `${config.type}: ${config.url}`}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                  <button onClick={() => startEditMcp(name, config)} style={smallSecondaryStyle}>Edit</button>
                  <button onClick={() => deleteMcp(name)} style={{ ...smallSecondaryStyle, color: '#f44336', borderColor: 'rgba(244,67,54,0.4)' }}>Del</button>
                </div>
              </div>
            ))}
            {Object.keys(mcpServers).length === 0 && (
              <div style={{ padding: 12, fontSize: 12, color: 'var(--text-secondary)', textAlign: 'center' }}>
                No MCP servers configured.
              </div>
            )}
            <button onClick={startAddMcp} style={{ ...buttonSecondaryStyle, marginTop: 8, width: '100%' }}>
              + Add MCP Server
            </button>
          </div>

          {(isAddingMcp || editingMcp !== null) && (
            <div style={{ padding: 12, background: 'var(--bg-secondary)', borderRadius: 8, border: '1px solid var(--border-color)' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 12 }}>
                {isAddingMcp ? 'New MCP Server' : `Edit: ${editingMcp}`}
              </div>
              <label style={labelStyle}>
                Server Name
                <input value={mcpName} onChange={(e) => setMcpName(e.target.value)} placeholder="my-server" style={inputStyle} disabled={editingMcp !== null} />
              </label>
              <label style={{ ...labelStyle, marginTop: 8 }}>
                Type
                <select value={mcpType} onChange={(e) => setMcpType(e.target.value as 'stdio' | 'sse' | 'http')} style={inputStyle}>
                  <option value="stdio">stdio (command)</option>
                  <option value="sse">SSE (Server-Sent Events)</option>
                  <option value="http">HTTP (streamable)</option>
                </select>
              </label>
              {mcpType === 'stdio' ? (<>
                <label style={{ ...labelStyle, marginTop: 8 }}>
                  Command
                  <input value={mcpCommand} onChange={(e) => setMcpCommand(e.target.value)} placeholder="npx" style={inputStyle} />
                </label>
                <label style={{ ...labelStyle, marginTop: 8 }}>
                  Arguments (space-separated)
                  <input value={mcpArgs} onChange={(e) => setMcpArgs(e.target.value)} placeholder="-y @scope/server" style={inputStyle} />
                </label>
                <label style={{ ...labelStyle, marginTop: 8 }}>
                  Environment (KEY=VALUE, one per line)
                  <textarea value={mcpEnv} onChange={(e) => setMcpEnv(e.target.value)} placeholder="API_KEY=xxx" rows={3} style={{ ...inputStyle, resize: 'vertical' }} />
                </label>
              </>) : (<>
                <label style={{ ...labelStyle, marginTop: 8 }}>
                  URL
                  <input value={mcpUrl} onChange={(e) => setMcpUrl(e.target.value)} placeholder={mcpType === 'sse' ? 'https://example.com/sse' : 'https://example.com/mcp'} style={inputStyle} />
                </label>
              </>)}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
                <button onClick={() => { setIsAddingMcp(false); setEditingMcp(null); }} style={buttonSecondaryStyle}>Cancel</button>
                <button onClick={saveMcp} style={buttonPrimaryStyle}>Save</button>
              </div>
            </div>
          )}
        </>)}
        {activeTab === 'models' && (
          <div style={{ padding: 16, color: 'var(--text-secondary)', fontSize: 13 }}>
            <p>Model settings coming soon — configure custom models, fallback behavior, and model-specific parameters.</p>
          </div>
        )}
        {activeTab === 'general' && (
          <div style={{ padding: 16, color: 'var(--text-secondary)', fontSize: 13 }}>
            <p>General settings coming soon — theme, editor preferences, keyboard shortcuts, and more.</p>
          </div>
        )}
      </div>
      </div>
      </div>
    </div>
  );
};

export default SettingsPanel;
