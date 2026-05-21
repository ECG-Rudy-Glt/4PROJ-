import { FormEvent, useEffect, useMemo, useState } from 'react';
import type { LoginResult, SyncStatus } from '../shared/types';

const initialStatus: SyncStatus = {
  state: 'signed-out',
  message: 'Connectez-vous',
  pending: 0,
  serverUrl: 'http://localhost:5001',
};

type MfaSetupState = {
  secret: string;
  qrCodeDataUrl: string;
  backupCodes: string[];
};

function stateLabel(status: SyncStatus) {
  switch (status.state) {
    case 'syncing':
      return 'Synchronisation';
    case 'paused':
      return 'En pause';
    case 'offline':
      return 'Hors ligne';
    case 'error':
      return 'Erreur';
    case 'conflict':
      return 'Conflit';
    case 'setup':
      return 'Configuration';
    case 'signed-out':
      return 'Déconnecté';
    default:
      return 'À jour';
  }
}

function useStatus() {
  const [status, setStatus] = useState<SyncStatus>(initialStatus);
  const [logs, setLogs] = useState<string[]>([]);

  useEffect(() => {
    window.supfile.getStatus().then(setStatus).catch(() => undefined);
    const offStatus = window.supfile.onStatus(setStatus);
    const offLog = window.supfile.onLog((message) => {
      setLogs((current) => [message, ...current].slice(0, 80));
    });
    return () => {
      offStatus();
      offLog();
    };
  }, []);

  return { status, logs };
}

function LoginPanel({ serverUrl }: { serverUrl?: string }) {
  const [url, setUrl] = useState(serverUrl || 'http://localhost:5001');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [backupCode, setBackupCode] = useState('');
  const [rememberDevice, setRememberDevice] = useState(true);
  const [mode, setMode] = useState<'login' | 'mfa' | 'backup' | 'setup'>('login');
  const [setup, setSetup] = useState<MfaSetupState | null>(null);
  const [setupCode, setSetupCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const completeLogin = async (result: LoginResult) => {
    if (result.state === 'mfa-required') {
      setMode('mfa');
      return;
    }
    if (result.state === 'mfa-setup-required') {
      const setupData = await window.supfile.setupMfa();
      setSetup(setupData);
      setMode('setup');
      return;
    }
    await window.supfile.startSync();
  };

  const handleLogin = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      await completeLogin(await window.supfile.login({ serverUrl: url, email, password }));
    } catch (err: any) {
      setError(err?.response?.data?.error || err.message || 'Connexion impossible');
    } finally {
      setLoading(false);
    }
  };

  const handleMfa = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      const result = mode === 'backup'
        ? await window.supfile.verifyBackupCode({ backupCode, rememberDevice })
        : await window.supfile.verifyMfa({ token: mfaCode, rememberDevice });
      await completeLogin(result);
    } catch (err: any) {
      setError(err?.response?.data?.error || err.message || 'Code invalide');
    } finally {
      setLoading(false);
    }
  };

  const handleMfaSetup = async (event: FormEvent) => {
    event.preventDefault();
    if (!setup) return;
    setError('');
    setLoading(true);
    try {
      const result = await window.supfile.verifyMfaSetup({
        token: setupCode,
        secret: setup.secret,
        backupCodes: setup.backupCodes,
        rememberDevice,
      });
      await completeLogin(result);
    } catch (err: any) {
      setError(err?.response?.data?.error || err.message || 'Configuration MFA impossible');
    } finally {
      setLoading(false);
    }
  };

  if (mode === 'setup' && setup) {
    return (
      <section className="panel auth-panel">
        <h1>SupFile Sync</h1>
        <p className="muted">Configuration MFA obligatoire pour finaliser la session desktop.</p>
        <img className="qr" src={setup.qrCodeDataUrl} alt="QR code MFA" />
        <p className="secret">{setup.secret}</p>
        <div className="codes">
          {setup.backupCodes.map((code) => <span key={code}>{code}</span>)}
        </div>
        <form onSubmit={handleMfaSetup} className="form">
          <input value={setupCode} onChange={(event) => setSetupCode(event.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="Code MFA" required />
          <label className="check">
            <input type="checkbox" checked={rememberDevice} onChange={(event) => setRememberDevice(event.target.checked)} />
            Se souvenir de cet appareil
          </label>
          {error && <p className="error">{error}</p>}
          <button disabled={loading}>{loading ? 'Vérification...' : 'Activer et continuer'}</button>
        </form>
      </section>
    );
  }

  if (mode === 'mfa' || mode === 'backup') {
    return (
      <section className="panel auth-panel">
        <h1>SupFile Sync</h1>
        <p className="muted">Saisissez le second facteur pour autoriser ce poste Windows.</p>
        <form onSubmit={handleMfa} className="form">
          {mode === 'backup' ? (
            <input value={backupCode} onChange={(event) => setBackupCode(event.target.value.toUpperCase())} placeholder="Code de secours" required />
          ) : (
            <input value={mfaCode} onChange={(event) => setMfaCode(event.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="Code MFA" required />
          )}
          <label className="check">
            <input type="checkbox" checked={rememberDevice} onChange={(event) => setRememberDevice(event.target.checked)} />
            Se souvenir de cet appareil
          </label>
          {error && <p className="error">{error}</p>}
          <button disabled={loading}>{loading ? 'Vérification...' : 'Valider'}</button>
          <button type="button" className="ghost" onClick={() => setMode(mode === 'backup' ? 'mfa' : 'backup')}>
            {mode === 'backup' ? 'Utiliser un code MFA' : 'Utiliser un code de secours'}
          </button>
        </form>
      </section>
    );
  }

  return (
    <section className="panel auth-panel">
      <h1>SupFile Sync</h1>
      <p className="muted">Connectez ce poste à votre espace SupFile.</p>
      <form onSubmit={handleLogin} className="form">
        <label>
          Serveur SupFile
          <input value={url} onChange={(event) => setUrl(event.target.value)} placeholder="http://localhost:5001" required />
        </label>
        <label>
          Email
          <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
        </label>
        <label>
          Mot de passe
          <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required />
        </label>
        {error && <p className="error">{error}</p>}
        <button disabled={loading}>{loading ? 'Connexion...' : 'Se connecter'}</button>
      </form>
    </section>
  );
}

function SetupPanel({ status }: { status: SyncStatus }) {
  const [loading, setLoading] = useState(false);

  const chooseFolder = async () => {
    setLoading(true);
    try {
      await window.supfile.chooseFolder();
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="panel">
      <h1>Choisir le dossier local</h1>
      <p className="muted">Le contenu sera synchronisé avec le dossier distant SupFile Sync.</p>
      <div className="summary-row">
        <span>Serveur</span>
        <strong>{status.serverUrl}</strong>
      </div>
      <button onClick={chooseFolder} disabled={loading}>{loading ? 'Ouverture...' : 'Choisir un dossier'}</button>
    </section>
  );
}

function Dashboard({ status, logs }: { status: SyncStatus; logs: string[] }) {
  const [busy, setBusy] = useState(false);
  const tone = useMemo(() => {
    if (status.state === 'error') return 'bad';
    if (status.state === 'offline' || status.state === 'paused' || status.state === 'conflict') return 'warn';
    if (status.state === 'syncing') return 'busy';
    return 'ok';
  }, [status.state]);

  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await action();
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="dashboard">
      <section className="panel hero-panel">
        <div>
          <p className={`pill ${tone}`}>{stateLabel(status)}</p>
          <h1>{status.message}</h1>
          <p className="muted">{status.localDir}</p>
        </div>
        <div className="actions">
          <button disabled={busy || status.state === 'syncing'} onClick={() => run(() => window.supfile.syncNow())}>Synchroniser</button>
          {status.state === 'paused' ? (
            <button className="secondary" disabled={busy} onClick={() => run(() => window.supfile.resume())}>Reprendre</button>
          ) : (
            <button className="secondary" disabled={busy} onClick={() => run(() => window.supfile.pause())}>Pause</button>
          )}
          <button className="danger" disabled={busy} onClick={() => run(() => window.supfile.logout())}>Déconnexion</button>
        </div>
      </section>

      <section className="grid">
        <div className="panel">
          <h2>État</h2>
          <div className="summary-row">
            <span>Dossier distant</span>
            <strong>{status.remoteRootId || 'Non initialisé'}</strong>
          </div>
          <div className="summary-row">
            <span>Dernière sync</span>
            <strong>{status.lastSyncAt ? new Date(status.lastSyncAt).toLocaleString() : 'Jamais'}</strong>
          </div>
          {status.lastError && <p className="error">{status.lastError}</p>}
        </div>
        <div className="panel">
          <h2>Journal</h2>
          <div className="log-list">
            {logs.length === 0 ? <p className="muted">Aucun événement pour le moment.</p> : logs.map((line) => <p key={line}>{line}</p>)}
          </div>
        </div>
      </section>
    </main>
  );
}

export default function App() {
  const { status, logs } = useStatus();

  return (
    <div className="app-shell">
      {status.state === 'signed-out' ? (
        <LoginPanel serverUrl={status.serverUrl} />
      ) : status.state === 'setup' ? (
        <SetupPanel status={status} />
      ) : (
        <Dashboard status={status} logs={logs} />
      )}
    </div>
  );
}
