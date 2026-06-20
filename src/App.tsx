import React from 'react';
import { Redirect, Route } from 'react-router-dom';
import {
  IonApp,
  IonRouterOutlet,
  setupIonicReact,
  IonTabs,
  IonTabBar,
  IonTabButton,
  IonIcon,
  IonLabel,
} from '@ionic/react';
import { IonReactRouter } from '@ionic/react-router';
import { shieldOutline, lockClosedOutline } from 'ionicons/icons';
import { useLocation } from 'react-router-dom';
import Home from './pages/Home';
import { SecurityProvider, useSecurity } from './contexts/SecurityContext';
import { VaultProvider } from './contexts/VaultContext';
import AuthPage from './pages/Auth/AuthPage';
import { LockOverlay } from './components/Auth/LockOverlay';
import ShaderBackground from './components/ui/shader-background';

// Páginas do Módulo 2 (Cofre Cripto)
import { VaultListPage } from './pages/Vault/VaultListPage';
import { VaultFormPage } from './pages/Vault/VaultFormPage';
import { VaultDetailPage } from './pages/Vault/VaultDetailPage';

// Novas páginas de Segurança e Hardening (Módulos 3, 4, 5 e 6)
import { HardeningPage } from './pages/Hardening/HardeningPage';
import { AnalysisPage } from './pages/Analysis/AnalysisPage';
import { EducationPage } from './pages/Education/EducationPage';
import { SettingsPage } from './pages/Settings/SettingsPage';

/* Core CSS required for Ionic components to work properly */
import '@ionic/react/css/core.css';

/* Basic CSS for apps built with Ionic */
import '@ionic/react/css/normalize.css';
import '@ionic/react/css/structure.css';
import '@ionic/react/css/typography.css';

/* Optional CSS utils that can be commented out */
import '@ionic/react/css/padding.css';
import '@ionic/react/css/float-elements.css';
import '@ionic/react/css/text-alignment.css';
import '@ionic/react/css/text-transformation.css';
import '@ionic/react/css/flex-utils.css';
import '@ionic/react/css/display.css';

/* Theme variables */
import './theme/variables.css';

setupIonicReact();

// Renderiza o fundo animado em todas as rotas exceto na Home (que usa o robô Spline)
const RouteAwareShaderBackground: React.FC = () => {
  const location = useLocation();
  const isHome = location.pathname === '/home';
  if (isHome) return null;
  return <ShaderBackground />;
};

const AppContent: React.FC = () => {
  const { isLoggedIn, isLocked } = useSecurity();

  return (
    <IonApp style={{ background: '#0a0b10' }}>
      {!isLoggedIn ? (
        <AuthPage />
      ) : (
        <VaultProvider>
          <IonReactRouter>
            <RouteAwareShaderBackground />
            <IonTabs>
              <IonRouterOutlet>
                {/* Abas Principais */}
                <Route exact path="/home">
                  <Home />
                </Route>
                <Route exact path="/vault">
                  <VaultListPage />
                </Route>

                {/* Novas Rotas dos Módulos 3, 4, 5 e 6 */}
                <Route exact path="/hardening">
                  <HardeningPage />
                </Route>
                <Route exact path="/analysis">
                  <AnalysisPage />
                </Route>
                <Route exact path="/education">
                  <EducationPage />
                </Route>
                <Route exact path="/settings">
                  <SettingsPage />
                </Route>

                {/* Subpáginas do Cofre (Sem Tab Bar visível ou herdadas) */}
                <Route exact path="/vault/add">
                  <VaultFormPage />
                </Route>
                <Route exact path="/vault/edit/:id">
                  <VaultFormPage />
                </Route>
                <Route exact path="/vault/detail/:id">
                  <VaultDetailPage />
                </Route>

                <Route exact path="/">
                  <Redirect to="/vault" />
                </Route>
              </IonRouterOutlet>

              {/* Tab Bar Customizada Premium */}
              <IonTabBar
                slot="bottom"
                style={{
                  '--background': '#0c0d14',
                  borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                  height: '65px',
                  paddingBottom: '6px',
                }}
              >
                <IonTabButton
                  tab="vault"
                  href="/vault"
                  style={{
                    '--color': 'rgba(255,255,255,0.4)',
                    '--color-selected': '#3880ff',
                    background: 'transparent',
                  }}
                >
                  <IonIcon icon={lockClosedOutline} style={{ fontSize: '22px' }} />
                  <IonLabel style={{ fontSize: '0.75rem', fontWeight: '600' }}>Cofre</IonLabel>
                </IonTabButton>

                <IonTabButton
                  tab="home"
                  href="/home"
                  style={{
                    '--color': 'rgba(255,255,255,0.4)',
                    '--color-selected': '#3880ff',
                    background: 'transparent',
                  }}
                >
                  <IonIcon icon={shieldOutline} style={{ fontSize: '22px' }} />
                  <IonLabel style={{ fontSize: '0.75rem', fontWeight: '600' }}>Painel Seg</IonLabel>
                </IonTabButton>
              </IonTabBar>
            </IonTabs>
          </IonReactRouter>
        </VaultProvider>
      )}

      {isLocked && <LockOverlay />}
    </IonApp>
  );
};

const App: React.FC = () => (
  <SecurityProvider>
    <AppContent />
  </SecurityProvider>
);

export default App;
