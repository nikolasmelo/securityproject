import React, { useState, useEffect } from 'react';
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonItem,
  IonLabel,
  IonInput,
  IonButton,
  IonIcon,
  IonButtons,
  IonBackButton,
  IonTextarea,
  IonToast,
  IonModal,
  IonToggle,
} from '@ionic/react';
import {
  saveOutline,
  eyeOutline,
  eyeOffOutline,
  keyOutline,
  globeOutline,
  personOutline,
  lockClosedOutline,
  documentTextOutline,
} from 'ionicons/icons';
import { useHistory, useParams } from 'react-router-dom';
import { useVault } from '../../contexts/VaultContext';
import { PasswordGenerator } from '../../components/Vault/PasswordGenerator';

export const VaultFormPage: React.FC = () => {
  const history = useHistory();
  const { id } = useParams<{ id?: string }>();
  const { items, createItem, updateItem } = useVault();

  const [title, setTitle] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [url, setUrl] = useState('');
  const [notes, setNotes] = useState('');
  
  const [showPassword, setShowPassword] = useState(false);
  const [showGenModal, setShowGenModal] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMsg, setToastMsg] = useState('');

  const isEditMode = !!id;

  useEffect(() => {
    if (isEditMode && id) {
      const existing = items.find((item) => item.id === id);
      if (existing) {
        setTitle(existing.title);
        setUsername(existing.username);
        setPassword(existing._plaintextPassword);
        setUrl(existing.url);
        if (existing.encryptedNotes) {
          // Notas são descriptografadas em memória pelo Context/Service
          setNotes((existing as any)._plaintextNotes || '');
        }
      }
    }
  }, [isEditMode, id, items]);

  const handleSave = async () => {
    if (!title || !username || !password) {
      setToastMsg('Por favor, preencha Título, Usuário e Senha.');
      setShowToast(true);
      return;
    }

    try {
      if (isEditMode && id) {
        await updateItem(id, {
          title,
          username,
          password,
          url,
          notes: notes || undefined,
        });
        setToastMsg('Credencial atualizada com sucesso!');
      } else {
        await createItem({
          title,
          username,
          password,
          url,
          notes: notes || undefined,
        });
        setToastMsg('Credencial salva com sucesso!');
      }
      setShowToast(true);
      setTimeout(() => {
        history.goBack();
      }, 1000);
    } catch (e) {
      console.error(e);
      setToastMsg('Erro ao salvar credencial.');
      setShowToast(true);
    }
  };

  const handleSelectGeneratedPassword = (generated: string) => {
    setPassword(generated);
    setShowGenModal(false);
    setToastMsg('Senha gerada aplicada com sucesso!');
    setShowToast(true);
  };

  return (
    <IonPage style={{ background: 'transparent' }}>
      <IonHeader className="ion-no-border">
        <IonToolbar style={{ '--background': 'transparent', '--color': '#e8ecf2' }}>
          <IonButtons slot="start">
            <IonBackButton defaultHref="/vault" style={{ color: '#fff' }} />
          </IonButtons>
          <IonTitle style={{ fontWeight: '700', fontSize: '1.25rem' }}>
            {isEditMode ? 'Editar Credencial' : 'Nova Credencial'}
          </IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent style={{ '--background': 'transparent' }}>
        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>


          {/* Título da Credencial */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <span style={{ color: '#94a3b8', fontSize: '0.85rem', fontWeight: '600', marginLeft: '4px' }}>
              Nome do Serviço
            </span>
            <IonItem lines="none" style={{ '--background': 'rgba(20, 28, 45, 0.7)', '--border-radius': '14px', border: '1px solid rgba(255,255,255,0.08)' }}>
              <IonIcon icon={keyOutline} slot="start" style={{ color: '#3880ff' }} />
              <IonInput
                value={title}
                onIonInput={(e) => setTitle(e.detail.value ?? '')}
                placeholder="Ex: Google, Netflix, Banco"
                style={{ '--color': '#fff' }}
              />
            </IonItem>
          </div>

          {/* Usuário / E-mail */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.85rem', fontWeight: '600', marginLeft: '4px' }}>
              Nome de Usuário / E-mail
            </span>
            <IonItem lines="none" style={{ '--background': 'rgba(255,255,255,0.04)', '--border-radius': '14px', border: '1px solid rgba(255,255,255,0.05)' }}>
              <IonIcon icon={personOutline} slot="start" style={{ color: '#3880ff' }} />
              <IonInput
                value={username}
                onIonInput={(e) => setUsername(e.detail.value ?? '')}
                placeholder="usuario@email.com"
                style={{ '--color': '#fff' }}
              />
            </IonItem>
          </div>

          {/* Senha */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.85rem', fontWeight: '600', marginLeft: '4px' }}>
              Senha de Acesso
            </span>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <IonItem lines="none" style={{ flex: '1', '--background': 'rgba(20, 28, 45, 0.7)', '--border-radius': '14px', border: '1px solid rgba(255,255,255,0.08)' }}>
                <IonIcon icon={lockClosedOutline} slot="start" style={{ color: '#3880ff' }} />
                <IonInput
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onIonInput={(e) => setPassword(e.detail.value ?? '')}
                  placeholder="••••••••••••"
                  style={{ '--color': '#fff', fontFamily: showPassword ? 'monospace' : 'inherit' }}
                />
                <IonButton fill="clear" color="light" slot="end" onClick={() => setShowPassword(!showPassword)}>
                  <IonIcon icon={showPassword ? eyeOffOutline : eyeOutline} style={{ color: '#94a3b8' }} />
                </IonButton>
              </IonItem>
              <IonButton
                onClick={() => setShowGenModal(true)}
                style={{
                  height: '48px',
                  '--background': 'rgba(56, 128, 255, 0.1)',
                  '--color': '#3880ff',
                  '--border-radius': '14px',
                  margin: '0',
                }}
              >
                <IonIcon icon={keyOutline} slot="icon-only" />
              </IonButton>
            </div>
          </div>

          {/* URL do Website */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.85rem', fontWeight: '600', marginLeft: '4px' }}>
              Endereço / URL do Site
            </span>
            <IonItem lines="none" style={{ '--background': 'rgba(255,255,255,0.04)', '--border-radius': '14px', border: '1px solid rgba(255,255,255,0.05)' }}>
              <IonIcon icon={globeOutline} slot="start" style={{ color: '#3880ff' }} />
              <IonInput
                value={url}
                onIonInput={(e) => setUrl(e.detail.value ?? '')}
                placeholder="https://exemplo.com"
                style={{ '--color': '#fff' }}
              />
            </IonItem>
          </div>

          {/* Notas Seguras */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.85rem', fontWeight: '600', marginLeft: '4px' }}>
              Notas e Observações Protegidas
            </span>
            <IonItem lines="none" style={{ '--background': 'rgba(255,255,255,0.04)', '--border-radius': '14px', border: '1px solid rgba(255,255,255,0.05)' }}>
              <IonIcon icon={documentTextOutline} slot="start" style={{ color: '#3880ff', marginTop: '12px' }} />
              <IonTextarea
                value={notes}
                onIonInput={(e) => setNotes(e.detail.value ?? '')}
                placeholder="Adicione chaves de recuperação, códigos adicionais ou anotações secretas..."
                rows={4}
                style={{ '--color': '#fff', marginTop: '12px' }}
              />
            </IonItem>
          </div>

          {/* Botão de Ação */}
          <IonButton
            expand="block"
            onClick={handleSave}
            style={{
              marginTop: '12px',
              '--background': 'linear-gradient(135deg, #3880ff 0%, #1a54cc 100%)',
              '--border-radius': '14px',
              fontWeight: '700',
              height: '52px',
            }}
          >
            <IonIcon icon={saveOutline} slot="start" />
            Salvar Credencial
          </IonButton>
        </div>

        {/* Modal do Gerador de Senhas Integrado */}
        <IonModal
          isOpen={showGenModal}
          onDidDismiss={() => setShowGenModal(false)}
          initialBreakpoint={0.75}
          breakpoints={[0, 0.75, 0.95]}
          style={{
            '--background': '#0c0d14',
            '--border-radius': '24px 24px 0 0',
          }}
        >
          <div style={{ padding: '16px', background: '#0c0d14', height: '100%', overflowY: 'auto' }}>
            <PasswordGenerator onSelectPassword={handleSelectGeneratedPassword} />
            <IonButton
              expand="block"
              color="light"
              onClick={() => setShowGenModal(false)}
              style={{ marginTop: '16px', '--border-radius': '14px', fontWeight: '600' }}
            >
              Cancelar
            </IonButton>
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
