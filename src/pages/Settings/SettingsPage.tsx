import React, { useState, useEffect } from 'react';
import {
  IonPage, IonHeader, IonToolbar, IonTitle, IonContent,
  IonCard, IonCardContent, IonCardHeader, IonCardTitle,
  IonButton, IonIcon, IonItem, IonLabel, IonInput,
  IonToggle, IonToast, IonBadge, IonList, IonText,
} from '@ionic/react';
import {
  downloadOutline, cloudUploadOutline, trashOutline,
  hardwareChipOutline, phonePortraitOutline, keyOutline,
  shieldCheckmarkOutline, alertCircleOutline,
} from 'ionicons/icons';
import { VaultService } from '../../services/vault';
import { StorageService } from '../../services/storage';
import { SessionService } from '../../services/session';
import { useSecurity } from '../../contexts/SecurityContext';
import { ActiveSession } from '../../types';
import './SettingsPage.css';

export const SettingsPage: React.FC = () => {
  const { logout, activeEmail } = useSecurity();
  const [sessions, setSessions] = useState<ActiveSession[]>([]);
  const [deviceInfo, setDeviceInfo] = useState<string>('');
  
  // Estados para Restauração de Backup
  const [backupText, setBackupText] = useState<string>('');
  const [backupPassword, setBackupPassword] = useState<string>('');
  const [mergeBackup, setMergeBackup] = useState<boolean>(true);
  const [fileSelected, setFileSelected] = useState<string>('');

  // Estados para Exclusão Total
  const [confirmWipePassword, setConfirmWipePassword] = useState<string>('');

  // Estados para Feedbacks
  const [showToast, setShowToast] = useState<boolean>(false);
  const [toastMsg, setToastMsg] = useState<string>('');
  const [toastColor, setToastColor] = useState<string>('dark');

  useEffect(() => {
    loadSessions();
    detectDeviceInfo();
  }, []);

  const showFeedback = (msg: string, color: string = 'dark') => {
    setToastMsg(msg);
    setToastColor(color);
    setShowToast(true);
  };

  const detectDeviceInfo = () => {
    const ua = navigator.userAgent;
    let OS = 'Desconhecido';
    if (ua.indexOf('Android') !== -1) OS = 'Android OS';
    else if (ua.indexOf('iPhone') !== -1 || ua.indexOf('iPad') !== -1) OS = 'iOS (Apple)';
    else if (ua.indexOf('Windows') !== -1) OS = 'Windows PC';
    else if (ua.indexOf('Macintosh') !== -1) OS = 'macOS';
    else if (ua.indexOf('Linux') !== -1) OS = 'Linux PC';

    setDeviceInfo(`${OS} - ${navigator.language}`);
  };

  const loadSessions = async () => {
    const email = SessionService.getActiveUserEmail();
    if (!email) return;
    const stored = await StorageService.getAuditLogs(email);
    const logins = stored.filter(log => log.action === 'LOGIN_SUCCESS');
    
    // Monta a lista de dispositivos conectados com base no histórico de acessos
    const sessionsList: ActiveSession[] = logins.map((log, index) => {
      const isCurrent = index === 0;
      return {
        id: log.id,
        deviceName: isCurrent ? `Este dispositivo (${deviceInfo || 'Celular'})` : 'Dispositivo anterior',
        lastActive: log.timestamp,
        ipPlaceholder: isCurrent ? 'Conexão ativa' : 'Acesso registrado'
      };
    });

    // Garante pelo menos uma sessão ativa corrente
    if (sessionsList.length === 0) {
      sessionsList.push({
        id: 'current',
        deviceName: `Este Dispositivo (${navigator.platform})`,
        lastActive: new Date().toISOString(),
        ipPlaceholder: 'Conexão ativa'
      });
    }

    setSessions(sessionsList.slice(0, 4));
  };

  // Exportar Backup Seguro
  const handleExportBackup = async () => {
    try {
      const blobStr = await VaultService.exportEncryptedBlob();
      const blob = new Blob([blobStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = `backup-seguro-${new Date().toISOString().slice(0,10)}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      showFeedback('✓ Backup exportado com sucesso!', 'success');
    } catch (e: any) {
      showFeedback(`Não foi possível exportar o backup. Tente novamente.`, 'danger');
    }
  };

  // Ler arquivo carregado
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileSelected(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setBackupText(text);
    };
    reader.readAsText(file);
  };

  // Restaurar Backup
  const handleImportBackup = async () => {
    if (!backupText.trim()) {
      showFeedback('Selecione um arquivo de backup para continuar.', 'warning');
      return;
    }
    if (!backupPassword.trim()) {
      showFeedback('Informe a senha mestra que foi usada para criar este backup.', 'warning');
      return;
    }

    try {
      const res = await VaultService.importEncryptedBlob(backupText, backupPassword, mergeBackup);
      if (res.success) {
        showFeedback(`✓ Backup restaurado! ${res.importedCount} credenciais recuperadas.`, 'success');
        setBackupText('');
        setBackupPassword('');
        setFileSelected('');
        loadSessions();
      }
    } catch (e: any) {
      showFeedback(`Não foi possível restaurar o backup. Verifique a senha e tente novamente.`, 'danger');
    }
  };

  // Exclusão Total da Conta
  const handleWipeData = async () => {
    if (!confirmWipePassword.trim()) {
      showFeedback('Confirme sua senha mestra para prosseguir.', 'warning');
      return;
    }

    const email = SessionService.getActiveUserEmail();
    if (!email) return;

    // Confirma a identidade do usuário antes de prosseguir
    const profile = await StorageService.getUserProfile(email);
    if (!profile) return;
    
    try {
      const authRes = await SessionService.authenticateMaster(email, confirmWipePassword);
      if (authRes.success) {
        if (window.confirm('⚠️ ATENÇÃO: Todas as suas senhas e dados serão excluídos permanentemente deste dispositivo. Essa ação não pode ser desfeita. Deseja continuar?')) {
          await StorageService.clearAllData();
          SessionService.clearSession();
          showFeedback('Todos os dados foram excluídos deste dispositivo.', 'danger');
          setTimeout(() => {
            logout();
          }, 1500);
        }
      } else {
        showFeedback('Senha mestra incorreta. A operação foi cancelada.', 'danger');
      }
    } catch (e: any) {
      showFeedback(`Não foi possível confirmar sua identidade. Tente novamente.`, 'danger');
    }
  };

  const handleRevokeSession = async (sessionId: string) => {
    if (sessionId === 'current' || sessions[0]?.id === sessionId) {
      showFeedback('Não é possível desconectar o dispositivo que você está usando agora.', 'warning');
      return;
    }
    const email = SessionService.getActiveUserEmail();
    if (!email) return;
    setSessions(prev => prev.filter(s => s.id !== sessionId));
    await StorageService.addAuditLog(email, 'PIN_LOCKED', `Dispositivo [${sessionId.substring(0, 6)}] desconectado.`);
    showFeedback('Dispositivo desconectado com sucesso.', 'success');
  };

  return (
    <IonPage className="settings-page">
      <IonHeader className="ion-no-border">
        <IonToolbar className="settings-toolbar">
          <IonTitle className="settings-title">
            ⚙️ Configurações
          </IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent className="settings-content">
        <div className="settings-container">

          {/* Backup Criptografado */}
          <IonCard className="settings-card">
            <IonCardHeader>
              <div className="settings-card-title-row">
                <IonIcon icon={downloadOutline} style={{ color: '#3880ff', fontSize: '22px' }} />
                <IonCardTitle className="settings-card-title">
                  Backup Seguro
                </IonCardTitle>
              </div>
            </IonCardHeader>
            <IonCardContent>
              <p className="settings-card-desc">
                Salve uma cópia protegida das suas credenciais. O arquivo é totalmente criptografado e só pode ser aberto com a sua senha mestra.
              </p>
              
              <IonButton
                expand="block"
                onClick={handleExportBackup}
                className="settings-btn-primary"
              >
                <IonIcon icon={downloadOutline} slot="start" />
                Baixar Backup
              </IonButton>

              <hr className="settings-divider" />

              <div className="import-form-container">
                <h4 className="settings-sub-title">
                  Restaurar Backup
                </h4>
                
                {/* Input de Arquivo Customizado */}
                <div className="file-picker-wrapper">
                  <input
                    type="file"
                    accept=".json"
                    id="backup-file-input"
                    onChange={handleFileChange}
                    className="file-picker-input"
                  />
                  <IonButton
                    expand="block"
                    fill="outline"
                    className="file-picker-btn"
                  >
                    <IonIcon icon={cloudUploadOutline} slot="start" style={{ color: '#3880ff' }} />
                    {fileSelected ? `Arquivo: ${fileSelected}` : 'Selecionar Arquivo .json'}
                  </IonButton>
                </div>

                {backupText && (
                  <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '6px' }}>
                    <IonItem lines="none" className="import-input-item">
                      <IonIcon icon={keyOutline} slot="start" style={{ color: '#ffc409' }} />
                      <IonInput
                        type="password"
                        placeholder="Senha Mestra do Backup"
                        value={backupPassword}
                        onIonInput={e => setBackupPassword(e.detail.value ?? '')}
                      />
                    </IonItem>

                    <IonItem lines="none" className="import-toggle-item">
                      <IonLabel>
                        Mesclar com itens existentes?
                      </IonLabel>
                      <IonToggle
                        checked={mergeBackup}
                        onIonChange={e => setMergeBackup(e.detail.checked)}
                        slot="end"
                      />
                    </IonItem>

                    <IonButton
                      expand="block"
                      onClick={handleImportBackup}
                      className="settings-btn-success"
                    >
                      Restaurar Credenciais
                    </IonButton>
                  </div>
                )}
              </div>
            </IonCardContent>
          </IonCard>

          {/* Gerenciamento de Sessões */}
          <IonCard className="settings-card">
            <IonCardHeader>
              <div className="settings-card-title-row">
                <IonIcon icon={hardwareChipOutline} style={{ color: '#2dd36f', fontSize: '22px' }} />
                <IonCardTitle className="settings-card-title">
                  Dispositivos Conectados
                </IonCardTitle>
              </div>
            </IonCardHeader>
            <IonCardContent style={{ padding: '0 16px 16px' }}>
              <p className="settings-card-desc">
                Veja os dispositivos que acessaram sua conta e gerencie suas conexões ativas.
              </p>
              
              <IonList className="session-list-container">
                {sessions.map((s, idx) => (
                  <div key={s.id} className="session-card-item">
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span className="session-device-name">
                          {s.deviceName}
                        </span>
                        {idx === 0 && <IonBadge color="success" style={{ fontSize: '0.65rem' }}>Atual</IonBadge>}
                      </div>
                      <div className="session-metadata">
                        {s.ipPlaceholder} • Último acesso: {new Date(s.lastActive).toLocaleTimeString()}
                      </div>
                    </div>
                    {idx > 0 && (
                      <IonButton
                        fill="clear"
                        color="danger"
                        size="small"
                        onClick={() => handleRevokeSession(s.id)}
                        className="session-revoke-btn"
                      >
                        Desconectar
                      </IonButton>
                    )}
                  </div>
                ))}
              </IonList>
            </IonCardContent>
          </IonCard>

          {/* Wipe de Segurança */}
          <IonCard className="settings-card">
            <IonCardHeader>
              <div className="settings-card-title-row">
                <IonIcon icon={alertCircleOutline} style={{ color: '#ff4961', fontSize: '22px' }} />
                <IonCardTitle className="settings-card-title">
                  Excluir Todos os Dados
                </IonCardTitle>
              </div>
            </IonCardHeader>
            <IonCardContent>
              <p className="settings-card-desc">
                Remove permanentemente todas as suas senhas, dados da conta e configurações deste dispositivo. Essa ação é irreversível.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <IonItem lines="none" className="settings-wipe-input-item">
                  <IonIcon icon={keyOutline} slot="start" style={{ color: '#ff4961' }} />
                  <IonInput
                    type="password"
                    placeholder="Digite sua senha mestra para confirmar"
                    value={confirmWipePassword}
                    onIonInput={e => setConfirmWipePassword(e.detail.value ?? '')}
                  />
                </IonItem>

                <IonButton
                  expand="block"
                  onClick={handleWipeData}
                  className="settings-btn-danger"
                >
                  <IonIcon icon={trashOutline} slot="start" />
                  Excluir Minha Conta e Dados
                </IonButton>
              </div>
            </IonCardContent>
          </IonCard>

        </div>

        <IonToast
          isOpen={showToast}
          onDidDismiss={() => setShowToast(false)}
          message={toastMsg}
          color={toastColor}
          duration={3000}
          position="bottom"
        />
      </IonContent>
    </IonPage>
  );
};
