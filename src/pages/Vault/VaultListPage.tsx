import React, { useState } from 'react';
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonSearchbar,
  IonList,
  IonItem,
  IonLabel,
  IonButton,
  IonIcon,
  IonBadge,
  IonGrid,
  IonRow,
  IonCol,
  IonCard,
  IonCardContent,
  IonFab,
  IonFabButton,
  IonRefresher,
  IonRefresherContent,
  IonModal,
  IonItemSliding,
  IonItemOptions,
  IonItemOption,
  IonToast,
  RefresherEventDetail,
} from '@ionic/react';
import {
  addOutline,
  shieldOutline,
  lockClosedOutline,
  searchOutline,
  copyOutline,
  trashOutline,
  eyeOutline,
  refreshOutline,
  keyOutline,
} from 'ionicons/icons';
import { useVault } from '../../contexts/VaultContext';
import { PasswordGenerator } from '../../components/Vault/PasswordGenerator';
import { Clipboard } from '@capacitor/clipboard';
import './VaultListPage.css';

export const VaultListPage: React.FC = () => {
  const { filteredItems, loading, searchQuery, setSearchQuery, refreshVault, healthStats, removeItem } = useVault();
  const [showGenModal, setShowGenModal] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMsg, setToastMsg] = useState('');

  const handleRefresh = async (event: CustomEvent<RefresherEventDetail>) => {
    await refreshVault();
    event.detail.complete();
  };

  const copyUsername = async (e: React.MouseEvent, username: string) => {
    e.stopPropagation();
    try {
      await Clipboard.write({ string: username });
      setToastMsg('Usuário copiado!');
      setShowToast(true);
    } catch (err) {
      console.error(err);
    }
  };

  const getDomainIcon = (url: string) => {
    try {
      if (!url) return lockClosedOutline;
      const domain = new URL(url).hostname;
      return `https://www.google.com/s2/favicons?sz=64&domain=${domain}`;
    } catch {
      return lockClosedOutline;
    }
  };

  return (
    <IonPage className="vault-page">
      <IonHeader className="ion-no-border">
        <IonToolbar className="vault-toolbar">
          <IonTitle className="vault-title">
            Meu Cofre de Senhas
          </IonTitle>
          <IonButton
            slot="end"
            fill="clear"
            onClick={() => setShowGenModal(true)}
            className="vault-gen-btn"
          >
            <IonIcon icon={keyOutline} slot="start" />
            Criar Senha
          </IonButton>
        </IonToolbar>
      </IonHeader>

      <IonContent fullscreen className="vault-content">
        <IonRefresher slot="fixed" onIonRefresh={handleRefresh}>
          <IonRefresherContent pullingIcon={refreshOutline} refreshingSpinner="crescent" />
        </IonRefresher>

        <div className="vault-container">
          {/* Dashboard Resumo de Saúde das Senhas */}
          {healthStats && healthStats.total > 0 && (
            <IonCard className="health-dashboard-card">
              <IonCardContent style={{ padding: '20px' }}>
                <div className="health-header-row">
                  <IonIcon icon={shieldOutline} style={{ color: '#10b981', fontSize: '22px' }} />
                  <span>Diagnóstico de Segurança</span>
                </div>
                <IonGrid style={{ padding: '0' }}>
                  <IonRow>
                    <IonCol size="4" className="health-stat-col">
                      <div className="health-stat-val total">{healthStats.total}</div>
                      <div className="health-stat-label">Senhas</div>
                    </IonCol>
                    <IonCol size="4" className="health-stat-col middle-col">
                      <div className="health-stat-val weak">
                        {healthStats.weak}
                      </div>
                      <div className="health-stat-label">Vulneráveis</div>
                    </IonCol>
                    <IonCol size="4" className="health-stat-col">
                      <div className="health-stat-val reused">
                        {healthStats.reused}
                      </div>
                      <div className="health-stat-label">Repetidas</div>
                    </IonCol>
                  </IonRow>
                </IonGrid>
              </IonCardContent>
            </IonCard>
          )}

          {/* Barra de Busca Criptografada em RAM */}
          <IonSearchbar
            value={searchQuery}
            onIonInput={(e) => setSearchQuery(e.detail.value ?? '')}
            placeholder="Pesquise suas contas..."
            className="vault-searchbar"
          />

          {/* Listagem de Credenciais */}
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: '#94a3b8' }}>
              Abrindo seu cofre...
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="vault-empty-state">
              <IonIcon icon={lockClosedOutline} className="vault-empty-icon" />
              <div className="vault-empty-title">Cofre Vazio</div>
              <div className="vault-empty-desc">Comece a organizar sua vida digital! Toque no botão '+' abaixo para cadastrar sua primeira senha.</div>
            </div>
          ) : (
            <IonList style={{ background: 'transparent', padding: '0' }}>
              {filteredItems.map((item) => {
                const iconSrc = getDomainIcon(item.url);
                const isWeak =
                  item._plaintextPassword.length < 12 ||
                  !/[A-Z]/.test(item._plaintextPassword) ||
                  !/[0-9]/.test(item._plaintextPassword) ||
                  !/[!@#$%^&*]/.test(item._plaintextPassword);

                return (
                  <IonItemSliding key={item.id} className="vault-item-sliding">
                    <IonItem
                      routerLink={`/vault/detail/${item.id}`}
                      lines="none"
                      className="vault-item-card"
                    >
                      {typeof iconSrc === 'string' && iconSrc.startsWith('http') ? (
                        <img
                          src={iconSrc}
                          alt="favicon"
                          slot="start"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = 'data:image/svg+xml;utf8,<svg ...></svg>';
                          }}
                          className="vault-favicon"
                        />
                      ) : (
                        <IonIcon
                          icon={lockClosedOutline}
                          slot="start"
                          className="vault-default-icon"
                        />
                      )}

                      <IonLabel style={{ margin: '12px 0' }}>
                        <div className="vault-item-title-container">
                          <h2 className="vault-item-title">
                            {item.title}
                          </h2>
                          {isWeak && (
                            <IonBadge className="vault-item-badge-weak">
                              Senha Fraca
                            </IonBadge>
                          )}
                        </div>
                        <p className="vault-item-username">
                          {item.username}
                        </p>
                      </IonLabel>

                      <div slot="end" style={{ display: 'flex', gap: '6px' }}>
                        <IonButton
                          fill="clear"
                          color="light"
                          onClick={(e) => copyUsername(e, item.username)}
                          className="vault-item-copy-btn"
                        >
                          <IonIcon slot="icon-only" icon={copyOutline} style={{ fontSize: '18px', color: '#94a3b8' }} />
                        </IonButton>
                      </div>
                    </IonItem>

                    <IonItemOptions side="end">
                      <IonItemOption
                        color="danger"
                        onClick={() => removeItem(item.id)}
                        style={{ borderTopRightRadius: '16px', borderBottomRightRadius: '16px' }}
                      >
                        <IonIcon slot="icon-only" icon={trashOutline} />
                      </IonItemOption>
                    </IonItemOptions>
                  </IonItemSliding>
                );
              })}
            </IonList>
          )}
        </div>

        {/* FAB de adicionar credencial */}
        <IonFab vertical="bottom" horizontal="end" slot="fixed" className="vault-fab">
          <IonFabButton routerLink="/vault/add" className="vault-fab-btn">
            <IonIcon icon={addOutline} />
          </IonFabButton>
        </IonFab>

        {/* Modal do Gerador de Senhas */}
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
            <PasswordGenerator />
            <IonButton
              expand="block"
              color="light"
              onClick={() => setShowGenModal(false)}
              style={{ marginTop: '16px', '--border-radius': '14px', fontWeight: '600' }}
            >
              Fechar
            </IonButton>
          </div>
        </IonModal>

        <IonToast
          isOpen={showToast}
          onDidDismiss={() => setShowToast(false)}
          message={toastMsg}
          duration={1500}
          color="dark"
          position="bottom"
        />
      </IonContent>
    </IonPage>
  );
};
