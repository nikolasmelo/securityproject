import React, { useState, useEffect } from 'react';
import {
  IonPage, IonHeader, IonToolbar, IonTitle, IonContent,
  IonCard, IonCardContent, IonCardHeader, IonCardTitle,
  IonButton, IonIcon, IonToggle, IonItem, IonLabel,
  IonToast, IonBadge, IonText,
} from '@ionic/react';
import {
  shieldCheckmarkOutline, eyeOffOutline, clipboardOutline,
  trashOutline, checkmarkCircleOutline, warningOutline,
  phonePortraitOutline, lockClosedOutline, timeOutline,
} from 'ionicons/icons';
import { HardeningService } from '../../services/hardening';
import { ClipboardService } from '../../services/clipboard';
import { StorageService } from '../../services/storage';
import { SessionService } from '../../services/session';
import { AuditLog } from '../../types';
import './HardeningPage.css';

export const HardeningPage: React.FC = () => {
  const [screenshotBlocked, setScreenshotBlocked] = useState(false);
  const [clipboardDemo, setClipboardDemo] = useState(false);
  const [clipboardCountdown, setClipboardCountdown] = useState(0);
  const [isNative, setIsNative] = useState(false);
  const [recentLogs, setRecentLogs] = useState<AuditLog[]>([]);
  const [showToast, setShowToast] = useState(false);
  const [toastMsg, setToastMsg] = useState('');

  useEffect(() => {
    setIsNative(HardeningService.isNative());
    loadLogs();
  }, []);

  const loadLogs = async () => {
    const email = SessionService.getActiveUserEmail();
    if (!email) return;
    const logs = await StorageService.getAuditLogs(email);
    setRecentLogs(logs.slice(0, 6));
  };

  const handleScreenshotToggle = async (enabled: boolean) => {
    setScreenshotBlocked(enabled);
    if (enabled) {
      await HardeningService.enablePrivacyScreen();
      setToastMsg(isNative
        ? '🔒 Proteção ativada: capturas de tela bloqueadas no celular.'
        : '🛡️ Proteção de tela ativa no navegador.'
      );
    } else {
      await HardeningService.disablePrivacyScreen();
      setToastMsg('Proteção de tela desativada.');
    }
    setShowToast(true);
    await loadLogs();
  };

  const handleClipboardDemo = async () => {
    setClipboardDemo(true);
    const demoText = 'SenhaExemplo@123!Demo';
    await ClipboardService.copySecure(
      demoText,
      'Senha Demonstração',
      (msg, timeLeft) => {
        setClipboardCountdown(timeLeft);
        setToastMsg(`Área de transferência limpa em ${timeLeft}s`);
        if (timeLeft === 0) {
          setClipboardDemo(false);
          setShowToast(false);
          loadLogs();
        }
      }
    );
    setToastMsg(`Senha copiada! Ela será apagada da memória em 30s.`);
    setShowToast(true);
  };

  const handleClearNow = async () => {
    await ClipboardService.clearNow();
    setClipboardDemo(false);
    setClipboardCountdown(0);
    setToastMsg('Área de transferência limpa imediatamente ✓');
    setShowToast(true);
    await loadLogs();
  };

  return (
    <IonPage className="hardening-page">
      <IonHeader className="ion-no-border">
        <IonToolbar className="hardening-toolbar">
          <IonTitle className="hardening-title">
            🛡️ Blindagem do Aparelho
          </IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent className="hardening-content">
        <div className="hardening-container">

          {/* Status Card */}
          <div className={`hardening-status-banner ${isNative ? 'native' : 'web'}`}>
            <div className="status-banner-content">
              <IonIcon
                icon={isNative ? checkmarkCircleOutline : warningOutline}
                style={{ fontSize: '26px', color: isNative ? '#10b981' : '#fbbf24', filter: `drop-shadow(0 0 8px ${isNative ? 'rgba(16,185,129,0.3)' : 'rgba(251,191,36,0.3)'})` }}
              />
              <div>
                <div className="status-banner-title">
                  {isNative ? 'Segurança Nativa Ativa' : 'Executando em Modo Web'}
                </div>
                <div className="status-banner-desc">
                  {isNative
                    ? 'Proteções nativas ativadas de forma automática.'
                    : 'Instale o aplicativo oficial para ter todas as proteções nativas.'}
                </div>
              </div>
            </div>
          </div>

          {/* Proteção de Screenshots */}
          <IonCard className="hardening-card">
            <IonCardHeader>
              <div className="hardening-card-title-row">
                <IonIcon icon={eyeOffOutline} style={{ color: '#3b82f6', fontSize: '24px' }} />
                <IonCardTitle className="hardening-card-title">
                  Bloqueio de Capturas de Tela
                </IonCardTitle>
              </div>
            </IonCardHeader>
            <IonCardContent>
              <p className="hardening-card-desc">
                Esta função impede que outros aplicativos façam capturas de tela (screenshots) dos seus dados confidenciais e esconde o conteúdo do app no alternador de tarefas.
              </p>
              <IonItem lines="none" className="hardening-toggle-item">
                <IonIcon icon={phonePortraitOutline} slot="start" style={{ color: screenshotBlocked ? '#10b981' : '#7b8499', fontSize: '20px' }} />
                <IonLabel>
                  <h3>Proteger Tela</h3>
                  <p>
                    {screenshotBlocked ? 'Proteção ativada' : 'Proteção desativada'}
                  </p>
                </IonLabel>
                <IonToggle
                  checked={screenshotBlocked}
                  onIonChange={(e) => handleScreenshotToggle(e.detail.checked)}
                  slot="end"
                />
              </IonItem>
              {screenshotBlocked && (
                <div className="hardening-alert-success">
                  ✓ Proteção ativa. Ao tentar tirar uma captura de tela, a imagem ficará preta por segurança.
                </div>
              )}
            </IonCardContent>
          </IonCard>

          {/* Auto-Clear do Clipboard */}
          <IonCard className="hardening-card">
            <IonCardHeader>
              <div className="hardening-card-title-row">
                <IonIcon icon={clipboardOutline} style={{ color: '#fbbf24', fontSize: '24px' }} />
                <IonCardTitle className="hardening-card-title">
                  Limpeza da Área de Transferência
                </IonCardTitle>
              </div>
            </IonCardHeader>
            <IonCardContent>
              <p className="hardening-card-desc">
                Qualquer senha copiada do cofre é limpa da área de transferência após 30 segundos, evitando que outros apps maliciosos leiam sua senha.
              </p>

              {clipboardDemo && clipboardCountdown > 0 && (
                <div className="clipboard-timer-banner">
                  <div className="clipboard-timer-text">
                    <IonIcon icon={timeOutline} style={{ fontSize: '18px' }} />
                    <span>Limpando área de transferência em {clipboardCountdown}s</span>
                  </div>
                  <div className="clipboard-timer-indicator" style={{ width: `${(clipboardCountdown / 30) * 100}%` }} />
                </div>
              )}

              <div className="clipboard-actions">
                <IonButton
                  expand="block"
                  onClick={handleClipboardDemo}
                  disabled={clipboardDemo}
                  className="clipboard-btn-demo"
                  fill="clear"
                >
                  <IonIcon icon={clipboardOutline} slot="start" />
                  Testar Copiar Senha
                </IonButton>
                {clipboardDemo && (
                  <IonButton
                    onClick={handleClearNow}
                    className="clipboard-btn-clear"
                    fill="clear"
                  >
                    <IonIcon icon={trashOutline} slot="icon-only" />
                  </IonButton>
                )}
              </div>
            </IonCardContent>
          </IonCard>

          {/* Audit Log Recente */}
          <IonCard className="hardening-card">
            <IonCardHeader>
              <div className="hardening-card-title-row">
                <IonIcon icon={lockClosedOutline} style={{ color: '#06b6d4', fontSize: '24px' }} />
                <IonCardTitle className="hardening-card-title">
                  Últimos Eventos de Segurança
                </IonCardTitle>
              </div>
            </IonCardHeader>
            <IonCardContent style={{ padding: '0 20px 20px' }}>
              {recentLogs.length === 0 ? (
                <p style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Nenhum evento registrado no momento.</p>
              ) : (
                <div className="hardening-logs-wrapper">
                  {recentLogs.map((log) => (
                    <div key={log.id} className="hardening-log-item">
                      <span className="hardening-log-text">{log.details}</span>
                      <span className="hardening-log-time">
                        {new Date(log.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </IonCardContent>
          </IonCard>
        </div>

        <IonToast
          isOpen={showToast}
          onDidDismiss={() => setShowToast(false)}
          message={toastMsg}
          duration={2500}
          color="dark"
          position="bottom"
        />
      </IonContent>
    </IonPage>
  );
};
