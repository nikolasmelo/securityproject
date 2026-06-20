import React, { useState, useEffect } from 'react';
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButtons,
  IonBackButton,
  IonButton,
  IonIcon,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonItem,
  IonLabel,
  IonToast,
  IonModal,
  IonInput,
} from '@ionic/react';
import {
  eyeOutline,
  eyeOffOutline,
  copyOutline,
  createOutline,
  shieldCheckmarkOutline,
  timeOutline,
  globeOutline,
  personOutline,
  lockClosedOutline,
  documentTextOutline,
  trashOutline,
} from 'ionicons/icons';
import { useParams, useHistory } from 'react-router-dom';
import { useVault } from '../../contexts/VaultContext';
import { ClipboardService } from '../../services/clipboard';
import { StorageService } from '../../services/storage';
import { SessionService } from '../../services/session';
import { hashSHA256 } from '../../crypto/webcrypto';

export const VaultDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const history = useHistory();
  const { items, removeItem, revealPassword, revealHistoryPassword } = useVault();

  const [item, setItem] = useState<(typeof items)[0] | null>(null);
  const [plaintextPassword, setPlaintextPassword] = useState('');
  const [isRevealed, setIsRevealed] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMsg, setToastMsg] = useState('');

  // Segurança extra: confirmação com PIN antes de revelar
  const [showPinModal, setShowPinModal] = useState(false);
  const [enteredPin, setEnteredPin] = useState('');
  const [pinActionType, setPinActionType] = useState<'REVEAL' | 'REVEAL_HISTORY'>('REVEAL');
  const [selectedHistoryId, setSelectedHistoryId] = useState<string>('');

  useEffect(() => {
    const found = items.find((i) => i.id === id);
    if (found) {
      setItem(found);
    } else {
      history.replace('/vault');
    }
  }, [id, items, history]);

  const verifyPinAndProceed = async () => {
    if (!enteredPin) return;
    const email = SessionService.getActiveUserEmail();
    if (!email) return;

    // Busca o hash do PIN salvo pelo StorageService (mesmo local onde registerPIN salva)
    const savedPINHash = await StorageService.getPINHash(email);
    if (!savedPINHash) {
      setToastMsg('PIN rápido não cadastrado. Cadastre no menu de configurações.');
      setShowToast(true);
      setShowPinModal(false);
      setEnteredPin('');
      return;
    }

    // Compara usando o mesmo hashSHA256 que o registerPIN utiliza
    const inputPINHash = await hashSHA256(enteredPin);

    if (inputPINHash === savedPINHash) {
      setShowPinModal(false);
      setEnteredPin('');
      if (pinActionType === 'REVEAL') {
        const decrypted = await revealPassword(id);
        setPlaintextPassword(decrypted);
        setIsRevealed(true);
        setToastMsg('Senha revelada!');
        setShowToast(true);
      } else if (pinActionType === 'REVEAL_HISTORY' && selectedHistoryId) {
        const decrypted = await revealHistoryPassword(id, selectedHistoryId);
        setToastMsg(`Senha anterior: ${decrypted}`);
        setShowToast(true);
      }
    } else {
      setToastMsg('PIN incorreto. Tente novamente.');
      setShowToast(true);
      setEnteredPin('');
    }
  };

  const handleRevealClick = async () => {
    if (isRevealed) {
      setIsRevealed(false);
      setPlaintextPassword('');
    } else {
      // Se o usuário tem PIN configurado, pede confirmação via modal
      const email = SessionService.getActiveUserEmail();
      if (email) {
        const savedPINHash = await StorageService.getPINHash(email);
        if (savedPINHash) {
          setPinActionType('REVEAL');
          setShowPinModal(true);
          return;
        }
      }
      // Sem PIN configurado: revela diretamente (o usuário já está autenticado)
      const decrypted = await revealPassword(id);
      setPlaintextPassword(decrypted);
      setIsRevealed(true);
      setToastMsg('Senha revelada!');
      setShowToast(true);
    }
  };

  const handleRevealHistoryClick = (historyId: string) => {
    setSelectedHistoryId(historyId);
    setPinActionType('REVEAL_HISTORY');
    setShowPinModal(true);
  };

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await ClipboardService.copySecure(text, label, (msg, timeLeft) => {
        setToastMsg(msg);
        setShowToast(true);
      });
    } catch (err) {
      console.error(err);
      setToastMsg('Erro ao copiar dados.');
      setShowToast(true);
    }
  };

  const handleDelete = async () => {
    if (window.confirm('Tem certeza que deseja remover esta credencial permanentemente?')) {
      await removeItem(id);
      setToastMsg('Credencial deletada.');
      setShowToast(true);
      history.goBack();
    }
  };

  if (!item) return null;

  return (
    <IonPage style={{ background: 'transparent' }}>
      <IonHeader className="ion-no-border">
        <IonToolbar style={{ '--background': 'transparent', '--color': '#e8ecf2' }}>
          <IonButtons slot="start">
            <IonBackButton defaultHref="/vault" style={{ color: '#fff' }} />
          </IonButtons>
          <IonTitle style={{ fontWeight: '700' }}>Detalhes da Conta</IonTitle>
          <IonButtons slot="end">
            <IonButton routerLink={`/vault/edit/${item.id}`} color="primary">
              <IonIcon icon={createOutline} slot="icon-only" />
            </IonButton>
            <IonButton onClick={handleDelete} color="danger">
              <IonIcon icon={trashOutline} slot="icon-only" />
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent style={{ '--background': 'transparent' }}>
        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          {/* Card Principal de Credencial */}
          <IonCard
            style={{
              background: 'linear-gradient(135deg, rgba(20, 28, 45, 0.95) 0%, rgba(11, 15, 26, 0.95) 100%)',
              border: '1px solid rgba(74, 158, 255, 0.12)',
              borderRadius: '24px',
              margin: '0',
              boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.4)',
            }}
          >
            <IonCardHeader style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '12px' }}>
              <IonIcon
                icon={shieldCheckmarkOutline}
                style={{
                  color: '#2dd36f',
                  fontSize: '24px',
                  background: 'rgba(45, 211, 111, 0.1)',
                  borderRadius: '12px',
                  padding: '10px',
                }}
              />
              <div>
                <IonCardTitle style={{ color: '#f1f5f9', fontSize: '1.2rem', fontWeight: '800' }}>
                  {item.title}
                </IonCardTitle>
                <div style={{ fontSize: '0.75rem', color: '#2dd36f', marginTop: '2px', fontWeight: 'bold' }}>
                  Proteção Local Máxima
                </div>
              </div>
            </IonCardHeader>

            <IonCardContent style={{ display: 'flex', flexDirection: 'column', gap: '14px', paddingTop: '0' }}>
              {/* Usuário */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ fontSize: '0.75rem', color: '#7b8499', fontWeight: '600' }}>NOME DE USUÁRIO / E-MAIL</span>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: '#e8ecf2', fontSize: '1rem', fontWeight: '500' }}>{item.username}</span>
                  <IonButton fill="clear" color="primary" onClick={() => copyToClipboard(item.username, 'Usuário')} style={{ '--padding-end': '0' }}>
                    <IonIcon icon={copyOutline} />
                  </IonButton>
                </div>
              </div>

              {/* Senha Protegida */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '12px' }}>
                <span style={{ fontSize: '0.75rem', color: '#7b8499', fontWeight: '600' }}>SENHA DE ACESSO</span>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{
                    color: isRevealed ? '#e8ecf2' : 'rgba(255,255,255,0.35)',
                    fontFamily: 'monospace',
                    fontSize: '1.15rem',
                    letterSpacing: isRevealed ? '1px' : '3px',
                  }}>
                    {isRevealed ? plaintextPassword : '••••••••••••'}
                  </span>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <IonButton fill="clear" color="light" onClick={handleRevealClick}>
                      <IonIcon icon={isRevealed ? eyeOffOutline : eyeOutline} />
                    </IonButton>
                    <IonButton
                      fill="clear"
                      color="primary"
                      onClick={async () => {
                        const pass = isRevealed ? plaintextPassword : await revealPassword(id);
                        copyToClipboard(pass, 'Senha');
                      }}
                      style={{ '--padding-end': '0' }}
                    >
                      <IonIcon icon={copyOutline} />
                    </IonButton>
                  </div>
                </div>
              </div>

              {/* URL */}
              {item.url && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '12px' }}>
                  <span style={{ fontSize: '0.75rem', color: '#7b8499', fontWeight: '600' }}>URL / ENDEREÇO</span>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: '#e8ecf2', fontSize: '0.9rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '80%' }}>
                      {item.url}
                    </span>
                    <IonButton fill="clear" color="primary" onClick={() => copyToClipboard(item.url, 'URL')} style={{ '--padding-end': '0' }}>
                      <IonIcon icon={copyOutline} />
                    </IonButton>
                  </div>
                </div>
              )}
            </IonCardContent>
          </IonCard>

          {/* Histórico Criptográfico de Auditoria */}
          <div style={{ marginTop: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px', paddingLeft: '4px' }}>
              <IonIcon icon={timeOutline} style={{ color: '#3880ff', fontSize: '18px' }} />
              <span style={{ color: '#f1f5f9', fontWeight: 'bold', fontSize: '0.95rem' }}>Histórico de Alterações</span>
            </div>

            {!item.history || item.history.length === 0 ? (
              <div style={{ padding: '16px', background: 'rgba(20, 28, 45, 0.5)', borderRadius: '16px', textAlign: 'center', color: '#94a3b8', fontSize: '0.85rem' }}>
                Nenhuma versão anterior registrada.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {item.history.map((hist, index) => (
                  <div
                    key={hist.id}
                    style={{
                      background: 'rgba(20, 28, 45, 0.6)',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      borderRadius: '14px',
                      padding: '12px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <div>
                      <div style={{ color: '#e2e8f0', fontSize: '0.85rem', fontWeight: '600' }}>
                        Versão anterior #{item.history!.length - index}
                      </div>
                      <div style={{ color: '#7b8499', fontSize: '0.75rem', marginTop: '2px' }}>
                        Modificado em: {new Date(hist.updatedAt).toLocaleString()}
                      </div>
                    </div>
                    <IonButton
                      size="small"
                      fill="clear"
                      color="primary"
                      onClick={() => handleRevealHistoryClick(hist.id)}
                    >
                      <IonIcon icon={eyeOutline} slot="start" />
                      Revelar
                    </IonButton>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Modal de confirmação do PIN */}
        <IonModal
          isOpen={showPinModal}
          onDidDismiss={() => {
            setShowPinModal(false);
            setEnteredPin('');
          }}
          style={{
            '--background': 'rgba(12, 13, 20, 0.95)',
            '--border-radius': '24px',
            '--width': '90%',
            '--height': 'fit-content',
            '--max-height': '280px',
          }}
        >
          <div style={{ padding: '24px', textAlign: 'center', color: '#fff' }}>
            <h3 style={{ margin: '0 0 8px 0', fontWeight: 'bold' }}>Confirme sua Identidade</h3>
            <p style={{ margin: '0 0 16px 0', fontSize: '0.85rem', color: '#94a3b8' }}>
              Insira seu código PIN para liberar e visualizar a senha.
            </p>
            <IonItem lines="none" style={{ '--background': 'rgba(20, 28, 45, 0.6)', '--border-radius': '12px', marginBottom: '16px' }}>
              <IonInput
                type="password"
                inputmode="numeric"
                maxlength={6}
                value={enteredPin}
                onIonInput={(e) => setEnteredPin(e.detail.value ?? '')}
                placeholder="Código PIN"
                style={{ textAlign: 'center', letterSpacing: '4px', fontSize: '1.2rem', '--color': '#fff' }}
              />
            </IonItem>
            <div style={{ display: 'flex', gap: '8px' }}>
              <IonButton
                expand="block"
                color="light"
                onClick={() => setShowPinModal(false)}
                style={{ flex: '1', '--border-radius': '12px', margin: '0' }}
              >
                Cancelar
              </IonButton>
              <IonButton
                expand="block"
                onClick={verifyPinAndProceed}
                style={{ flex: '1', '--background': '#3880ff', '--border-radius': '12px', margin: '0' }}
              >
                Confirmar
              </IonButton>
            </div>
          </div>
        </IonModal>

        <IonToast
          isOpen={showToast}
          onDidDismiss={() => setShowToast(false)}
          message={toastMsg}
          duration={2000}
          color="dark"
          position="bottom"
        />
      </IonContent>
    </IonPage>
  );
};
