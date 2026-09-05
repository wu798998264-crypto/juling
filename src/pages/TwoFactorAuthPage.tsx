import { Fingerprint, ShieldCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import './TwoFactorAuthPage.css';
import { MfaVaultManager } from '../components/MfaVaultManager';

export function TwoFactorAuthPage() {
  const { t } = useTranslation();

  return (
    <main className="main-content ghcp-accounts-page two-factor-query-page">
      <div className="mfa-command-header">
        <div className="mfa-command-mark"><Fingerprint size={26} /></div>
        <div className="mfa-command-copy">
          <span className="mfa-command-kicker">SECURE TOKEN STATION</span>
          <h1>{t('twoFactorAuth.pageTitle')}</h1>
          <p>{t('twoFactorAuth.pageDescNew')}</p>
        </div>
        <div className="mfa-command-status"><ShieldCheck size={16} /> 本地加密域</div>
      </div>

      <MfaVaultManager />
    </main>
  );
}
