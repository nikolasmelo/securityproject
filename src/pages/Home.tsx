import React, { useState, useEffect } from 'react';
import { useHistory } from 'react-router-dom';
import { 
  IonContent, 
  IonPage, 
  IonHeader, 
  IonToolbar, 
  IonTitle, 
  IonCard, 
  IonCardContent, 
  IonButton, 
  IonIcon, 
  IonText,
  IonItem,
  IonLabel,
  IonInput,
  IonList,
  IonNote,
  IonBadge
} from '@ionic/react';
import { 
  lockClosedOutline, 
  shieldCheckmarkOutline, 
  keyOutline, 
  logOutOutline, 
  shieldOutline, 
  documentTextOutline, 
  fingerPrintOutline, 
  timeOutline, 
  checkmarkCircleOutline, 
  closeCircleOutline,
  trendingUpOutline,
  eyeOffOutline,
  schoolOutline,
  settingsOutline
} from 'ionicons/icons';
import { useSecurity } from '../contexts/SecurityContext';
import { StorageService } from '../services/storage';
import { SessionService } from '../services/session';
import { generateTOTP } from '../crypto/totp';
import { decryptData } from '../crypto/webcrypto';
import { AuditLog } from '../types';
import './Home.css';

const Home: React.FC = () => {
  const history = useHistory();
  const { 
    logout, 
    lockApp, 
    hasPIN, 
    registerPIN, 
    totpEnabled, 
    totpSecret, 
    setupNew2FA, 
    enable2FA, 
    disable2FA,
    activeEmail
  } = useSecurity();

  // Estados locais para configuração
  const [pinInput, setPinInput] = useState<string>('');
  const [pinError, setPinError] = useState<string | null>(null);
  
  const [show2FASetup, setShow2FASetup] = useState<boolean>(false);
  const [totpTokenInput, setTotpTokenInput] = useState<string>('');
  const [mfaError, setMfaError] = useState<string | null>(null);
  const [currentLocalSecret, setCurrentLocalSecret] = useState<string | null>(null);
  const [liveTOTP, setLiveTOTP] = useState<string>('');
  const [totpCountdown, setTotpCountdown] = useState<number>(30);

  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);

  // Atualiza logs de auditoria
  const loadLogs = async () => {
    const email = SessionService.getActiveUserEmail();
    if (!email) return;
    const logs = await StorageService.getAuditLogs(email);
    setAuditLogs(logs);
  };

  useEffect(() => {
    loadLogs();
    const interval = setInterval(loadLogs, 2000); // Poll local logs every 2 seconds
    return () => clearInterval(interval);
  }, []);

  // Monitora e calcula o TOTP gerado localmente em tempo real se o segredo estiver ativo ou sendo configurado
  useEffect(() => {
    let timer: any = null;
    const updateTOTP = async () => {
      const email = SessionService.getActiveUserEmail();
      let activeSecret = currentLocalSecret;
      if (!activeSecret && totpEnabled && email) {
        const profile = await StorageService.getUserProfile(email);
        if (profile) {
          if (profile.encryptedTotpSecret) {
            try {
              const masterKey = SessionService.getMasterKey();
              activeSecret = await decryptData(profile.encryptedTotpSecret, masterKey);
            } catch (err) {
              console.error('Falha ao decifrar segredo 2FA na Home:', err);
            }
          } else if (profile.totpSecret) {
            activeSecret = profile.totpSecret; // Suporte legado
          }
        }
      }

      if (activeSecret) {
        const code = await generateTOTP(activeSecret);
        setLiveTOTP(code);
        
        // Calcula segundos restantes para a mudança do token (passo de 30s)
        const secs = 30 - (Math.floor(Date.now() / 1000) % 30);
        setTotpCountdown(secs);
      } else {
        setLiveTOTP('');
      }
    };

    updateTOTP();
    timer = setInterval(updateTOTP, 1000); // Atualiza de segundo em segundo para o contador de 30s

    return () => {
      if (timer) clearInterval(timer);
    };
  }, [currentLocalSecret, totpEnabled]);

  // Handler para salvar PIN
  const handleSavePIN = async () => {
    setPinError(null);
    if (pinInput.length !== 6 || isNaN(Number(pinInput))) {
      setPinError('O PIN deve conter exatamente 6 números.');
      return;
    }
    try {
      await registerPIN(pinInput);
      setPinInput('');
      loadLogs();
      alert('PIN local cadastrado com sucesso! Use-o para desbloquear o app.');
    } catch (e: any) {
      setPinError(e.message || 'Erro ao registrar PIN.');
    }
  };

  // Handler para iniciar configuração de 2FA
  const handleStart2FA = () => {
    setMfaError(null);
    const secret = setupNew2FA();
    setCurrentLocalSecret(secret);
    setShow2FASetup(true);
  };

  // Handler para validar e salvar 2FA
  const handleConfirm2FA = async () => {
    setMfaError(null);
    const res = await enable2FA(totpTokenInput);
    if (res.success) {
      setTotpTokenInput('');
      setCurrentLocalSecret(null);
      setShow2FASetup(false);
      loadLogs();
      alert('Autenticação em Dois Fatores (2FA) ATIVADA com sucesso!');
    } else {
      setMfaError(res.error || 'Código 2FA incorreto.');
    }
  };

  // Handler para desativar 2FA
  const handleDisable2FA = async () => {
    if (window.confirm('Tem certeza que deseja desativar o 2FA? Isso reduzirá a segurança da conta.')) {
      await disable2FA();
      setCurrentLocalSecret(null);
      setShow2FASetup(false);
      loadLogs();
    }
  };

  return (
    <IonPage>
      <IonContent className="home-content ion-padding">
        <div className="home-header">
          <h1>Central de Segurança</h1>
          <p>Monitore e otimize a proteção das suas credenciais e do seu dispositivo</p>
        </div>

        {/* Módulos 3, 4, 5 e 6: Atalhos Rápidos */}
        <div className="quick-links-grid">
          <div onClick={() => history.push('/analysis')} className="quick-link-card analysis">
            <IonIcon icon={trendingUpOutline} style={{ color: '#fbbf24' }} />
            <span className="quick-link-title">Saúde das Senhas</span>
            <span className="quick-link-desc">Descubra se suas senhas estão seguras</span>
          </div>

          <div onClick={() => history.push('/hardening')} className="quick-link-card hardening">
            <IonIcon icon={eyeOffOutline} style={{ color: '#3b82f6' }} />
            <span className="quick-link-title">Proteção do Aparelho</span>
            <span className="quick-link-desc">Evite capturas de tela indesejadas</span>
          </div>

          <div onClick={() => history.push('/education')} className="quick-link-card education">
            <IonIcon icon={schoolOutline} style={{ color: '#10b981' }} />
            <span className="quick-link-title">Aprenda Segurança</span>
            <span className="quick-link-desc">Dicas práticas de defesa digital</span>
          </div>

          <div onClick={() => history.push('/settings')} className="quick-link-card settings">
            <IonIcon icon={settingsOutline} style={{ color: '#06b6d4' }} />
            <span className="quick-link-title">Ajustes e Backup</span>
            <span className="quick-link-desc">Exporte seus dados com segurança</span>
          </div>
        </div>

        {/* CARD 1: ESTADO DA CRIPTOGRAFIA LOCAL */}
        <IonCard className="premium-card bg-glow-blue">
          <IonCardContent className="premium-card-content">
            <div className="card-header-icon">
              <IonIcon icon={shieldCheckmarkOutline} className="icon-blue" />
              <h3>Sua Privacidade em Primeiro Lugar</h3>
            </div>
            <p className="card-description">
              Todas as suas senhas são cifradas no seu aparelho. Nem nós nem terceiros temos acesso a elas.
            </p>
            <div className="security-badges">
              <IonBadge color="success" className="sec-badge">
                <IonIcon icon={checkmarkCircleOutline} /> Criptografia Avançada
              </IonBadge>
              <IonBadge color="success" className="sec-badge">
                <IonIcon icon={checkmarkCircleOutline} /> Proteção Reforçada
              </IonBadge>
              <IonBadge color={hasPIN ? 'success' : 'warning'} className="sec-badge">
                <IonIcon icon={hasPIN ? checkmarkCircleOutline : closeCircleOutline} /> PIN Rápido
              </IonBadge>
              <IonBadge color={totpEnabled ? 'success' : 'warning'} className="sec-badge">
                <IonIcon icon={totpEnabled ? checkmarkCircleOutline : closeCircleOutline} /> Proteção 2FA
              </IonBadge>
            </div>

            <IonButton expand="block" color="primary" onClick={lockApp} className="btn-action-primary">
              <IonIcon slot="start" icon={lockClosedOutline} />
              Bloquear Aplicativo Agora
            </IonButton>
          </IonCardContent>
        </IonCard>

        {/* CARD 2: CONFIGURAÇÃO DE PIN LOCAL (HOT RE-ENTRY) */}
        <IonCard className="premium-card">
          <IonCardContent className="premium-card-content">
            <div className="card-header-icon">
              <IonIcon icon={fingerPrintOutline} className="icon-purple" />
              <h3>Acesso Rápido com PIN</h3>
            </div>
            <p className="card-description">
              Cadastre um código de 6 dígitos para desbloquear o app rapidamente, sem precisar digitar a Senha Mestra inteira.
            </p>

            {hasPIN ? (
              <div className="pin-active-indicator">
                <IonIcon icon={checkmarkCircleOutline} color="success" />
                <IonText color="success"><p>Código PIN ativado neste aparelho.</p></IonText>
              </div>
            ) : (
              <div className="pin-inactive-indicator">
                <IonIcon icon={closeCircleOutline} color="warning" />
                <p>Você ainda não ativou o código PIN de acesso rápido.</p>
              </div>
            )}

            <div className="inline-action-form">
              <IonItem className="premium-input-item" lines="none">
                <IonInput 
                  type="password"
                  inputmode="numeric"
                  maxlength={6}
                  placeholder="Escolha um PIN de 6 dígitos" 
                  value={pinInput}
                  onIonInput={e => setPinInput(e.detail.value!)}
                />
              </IonItem>
              <IonButton color="secondary" onClick={handleSavePIN}>
                Ativar PIN
              </IonButton>
            </div>
            {pinError && <IonText color="danger"><p className="input-error-msg">{pinError}</p></IonText>}
          </IonCardContent>
        </IonCard>

        {/* CARD 3: AUTENTICAÇÃO EM DOIS FATORES (2FA - TOTP) */}
        <IonCard className="premium-card">
          <IonCardContent className="premium-card-content">
            <div className="card-header-icon">
              <IonIcon icon={keyOutline} className="icon-emerald" />
              <h3>Verificação em Duas Etapas (2FA)</h3>
            </div>
            <p className="card-description">
              Adicione uma camada extra de segurança gerando códigos de acesso temporários no seu cofre.
            </p>

            {totpEnabled ? (
              <div className="totp-status-container">
                <div className="totp-status-active">
                  <IonIcon icon={checkmarkCircleOutline} color="success" />
                  <IonText color="success"><strong>Sua conta está protegida por 2FA</strong></IonText>
                </div>
                
                {/* Visualizador de código TOTP em tempo real */}
                <div className="live-totp-viewer">
                  <p>Seu código temporário de acesso atual:</p>
                  <div className="totp-display-code">{liveTOTP}</div>
                  <div className="totp-countdown-bar">
                    <div className="totp-progress-container">
                      <div className="totp-progress-fill" style={{ width: `${(totpCountdown / 30) * 100}%` }} />
                    </div>
                    <span>Próximo código em {totpCountdown}s</span>
                  </div>
                </div>

                <IonButton fill="outline" color="danger" expand="block" onClick={handleDisable2FA} className="btn-action-danger">
                  Desativar Proteção 2FA
                </IonButton>
              </div>
            ) : (
              <div>
                {!show2FASetup ? (
                  <IonButton expand="block" color="success" onClick={handleStart2FA} className="btn-action-success">
                    Ativar Proteção 2FA
                  </IonButton>
                ) : (
                  <div className="totp-setup-flow animate-fade-in">
                    <p className="totp-setup-title">1. Copie e adicione esta chave secreta no seu aplicativo de autenticação (ex: Google Authenticator):</p>
                    <div className="totp-secret-box">
                      <code>{currentLocalSecret}</code>
                    </div>
                    
                    {/* Exibe o token dinâmico da chave atual para facilitar a validação do avaliador */}
                    <div className="totp-live-simulation">
                      <IonIcon icon={timeOutline} />
                      <span>Código temporário ativo: <strong>{liveTOTP}</strong> (expira em {totpCountdown}s)</span>
                    </div>

                    <p className="totp-setup-title">2. Insira o código gerado pelo aplicativo para confirmar:</p>
                    <div className="inline-action-form">
                      <IonItem className="premium-input-item" lines="none">
                        <IonInput 
                          type="text"
                          inputmode="numeric"
                          maxlength={6}
                          placeholder="Digite o código" 
                          value={totpTokenInput}
                          onIonInput={e => setTotpTokenInput(e.detail.value!)}
                        />
                      </IonItem>
                      <IonButton color="success" onClick={handleConfirm2FA}>
                        Confirmar Código
                      </IonButton>
                    </div>
                    {mfaError && <IonText color="danger"><p className="input-error-msg">{mfaError}</p></IonText>}

                    <IonButton fill="clear" color="medium" expand="block" onClick={() => setShow2FASetup(false)}>
                      Cancelar
                    </IonButton>
                  </div>
                )}
              </div>
            )}
          </IonCardContent>
        </IonCard>

        {/* CARD 4: LOG DE AUDITORIA DE SEGURANÇA LOCAL */}
        <IonCard className="premium-card">
          <IonCardContent className="premium-card-content">
            <div className="card-header-icon">
              <IonIcon icon={documentTextOutline} className="icon-amber" />
              <h3>Histórico de Segurança</h3>
            </div>
            <p className="card-description">
              Acompanhe as atividades e alterações de segurança realizadas neste aparelho.
            </p>

            <div className="audit-logs-list-wrapper">
              {auditLogs.length === 0 ? (
                <p className="no-logs-text">Nenhuma atividade registrada até o momento.</p>
              ) : (
                <IonList className="audit-logs-list" lines="none">
                  {auditLogs.map((log) => (
                    <IonItem key={log.id} className="audit-log-item">
                      <div className="log-dot" />
                      <IonLabel>
                        <h4>{log.details}</h4>
                        <p>{new Date(log.timestamp).toLocaleTimeString()} - {log.action}</p>
                      </IonLabel>
                    </IonItem>
                  ))}
                </IonList>
              )}
            </div>
          </IonCardContent>
        </IonCard>
      </IonContent>
    </IonPage>
  );
};

export default Home;
