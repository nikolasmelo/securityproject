import React, { useState, useEffect } from 'react';
import {
  IonPage, IonHeader, IonToolbar, IonTitle, IonContent,
  IonCard, IonCardContent, IonCardHeader, IonCardTitle,
  IonIcon, IonButton, IonProgressBar, IonText, IonItem,
  IonLabel, IonBadge, IonRefresher, IonRefresherContent,
  RefresherEventDetail,
} from '@ionic/react';
import {
  shieldOutline, warningOutline, checkmarkCircleOutline,
  keyOutline, refreshOutline, trendingUpOutline, alertCircleOutline,
  copyOutline, closeCircleOutline,
} from 'ionicons/icons';
import { useVault } from '../../contexts/VaultContext';
import './AnalysisPage.css';

interface PasswordDetail {
  id: string;
  title: string;
  password: string;
  isWeak: boolean;
  isDuplicated: boolean;
  entropy: number;
  strengthLabel: string;
  strengthColor: string;
}

function calcEntropy(password: string): number {
  let poolSize = 0;
  if (/[a-z]/.test(password)) poolSize += 26;
  if (/[A-Z]/.test(password)) poolSize += 26;
  if (/[0-9]/.test(password)) poolSize += 10;
  if (/[^a-zA-Z0-9]/.test(password)) poolSize += 32;
  return poolSize > 0 ? Math.round(password.length * Math.log2(poolSize)) : 0;
}

function getStrength(entropy: number): { label: string; color: string; score: number } {
  if (entropy < 28) return { label: 'Muito Vulnerável', color: '#ff4961', score: 0.1 };
  if (entropy < 40) return { label: 'Fraca', color: '#ff6b35', score: 0.25 };
  if (entropy < 60) return { label: 'Média', color: '#ffc409', score: 0.5 };
  if (entropy < 80) return { label: 'Forte', color: '#3dc2ff', score: 0.75 };
  return { label: 'Muito Segura', color: '#2dd36f', score: 1.0 };
}

export const AnalysisPage: React.FC = () => {
  const { items, loading, refreshVault, healthStats } = useVault();
  const [details, setDetails] = useState<PasswordDetail[]>([]);
  const [filter, setFilter] = useState<'ALL' | 'WEAK' | 'DUPL'>('ALL');

  useEffect(() => {
    if (items.length === 0) return;

    const passwords = items.map(i => (i as any)._plaintextPassword as string);
    const dupMap = new Map<string, number>();
    passwords.forEach(p => dupMap.set(p, (dupMap.get(p) ?? 0) + 1));

    const computed: PasswordDetail[] = items.map(item => {
      const pwd = (item as any)._plaintextPassword as string;
      const entropy = calcEntropy(pwd);
      const { label, color } = getStrength(entropy);
      const isWeak = pwd.length < 12 || !/[A-Z]/.test(pwd) || !/[0-9]/.test(pwd) || !/[!@#$%^&*]/.test(pwd);
      const isDuplicated = (dupMap.get(pwd) ?? 1) > 1;
      return { id: item.id, title: item.title, password: '••••••••', isWeak, isDuplicated, entropy, strengthLabel: label, strengthColor: color };
    });

    setDetails(computed);
  }, [items]);

  const filtered = details.filter(d => {
    if (filter === 'WEAK') return d.isWeak;
    if (filter === 'DUPL') return d.isDuplicated;
    return true;
  });

  const handleRefresh = async (e: CustomEvent<RefresherEventDetail>) => {
    await refreshVault();
    e.detail.complete();
  };

  const secureScore = healthStats && healthStats.total > 0
    ? Math.round(((healthStats.total - healthStats.weak - healthStats.reused) / healthStats.total) * 100)
    : 0;

  const scoreClass = secureScore >= 70 ? 'excellent' : secureScore >= 40 ? 'warning' : 'danger';

  return (
    <IonPage className="analysis-page">
      <IonHeader className="ion-no-border">
        <IonToolbar className="analysis-toolbar">
          <IonTitle className="analysis-title">📊 Saúde das Senhas</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent className="analysis-content">
        <IonRefresher slot="fixed" onIonRefresh={handleRefresh}>
          <IonRefresherContent pullingIcon={refreshOutline} />
        </IonRefresher>

        <div className="analysis-container">

          {/* Score Geral */}
          <div className="analysis-score-card">
            <div className={`analysis-score-val ${scoreClass}`}>
              {secureScore}%
            </div>
            <div className="analysis-score-label">
              Pontuação Geral de Segurança
            </div>
            <IonProgressBar
              value={secureScore / 100}
              className={`analysis-progress-bar ${scoreClass}`}
            />
            <div className="analysis-stats-row">
              {[
                { label: 'Total', value: healthStats?.total ?? 0, color: '#ffffff' },
                { label: 'Fracas', value: healthStats?.weak ?? 0, color: '#ef4444' },
                { label: 'Repetidas', value: healthStats?.reused ?? 0, color: '#f59e0b' },
                { label: 'Seguras', value: healthStats?.strongCount ?? 0, color: '#10b981' },
              ].map(stat => (
                <div key={stat.label} className="analysis-stat-item">
                  <div className="analysis-stat-val" style={{ color: stat.color }}>{stat.value}</div>
                  <div className="analysis-stat-label">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Filtros */}
          <div className="analysis-filter-container">
            {(['ALL', 'WEAK', 'DUPL'] as const).map(f => (
              <IonButton
                key={f}
                size="small"
                fill="clear"
                onClick={() => setFilter(f)}
                className={`analysis-filter-btn ${filter === f ? 'active' : ''}`}
              >
                {f === 'ALL' ? 'Todas' : f === 'WEAK' ? '⚠️ Fracas' : '🔁 Repetidas'}
              </IonButton>
            ))}
          </div>

          {/* Lista de credenciais analisadas */}
          {loading ? (
            <div style={{ textAlign: 'center', color: '#94a3b8', padding: '40px' }}>Avaliando senhas...</div>
          ) : filtered.length === 0 ? (
            <div className="analysis-clean-state">
              <IonIcon icon={checkmarkCircleOutline} className="analysis-clean-icon" />
              <div className="analysis-clean-title">
                {filter === 'ALL' ? 'Nenhuma senha no cofre.' : 'Tudo limpo! Nenhuma senha fraca ou repetida.'}
              </div>
            </div>
          ) : (
            <div className="analysis-list">
              {filtered.map(item => {
                const borderClass = item.isWeak ? 'border-weak' : item.isDuplicated ? 'border-reused' : 'border-strong';
                return (
                  <div key={item.id} className={`analysis-item-card ${borderClass}`}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ flex: 1 }}>
                        <div className="analysis-card-title-row">
                          <span className="analysis-card-title">{item.title}</span>
                          {item.isWeak && <IonBadge color="danger" className="analysis-item-badge">Senha Fraca</IonBadge>}
                          {item.isDuplicated && <IonBadge color="warning" className="analysis-item-badge">Senha Repetida</IonBadge>}
                        </div>
                        <div className="analysis-card-meta-row">
                          <span className="analysis-strength-lbl" style={{ color: item.strengthColor }}>
                            {item.strengthLabel}
                          </span>
                          <span className="analysis-entropy-val">
                            • Pontuação: {item.entropy} pts
                          </span>
                        </div>
                      </div>
                      <IonButton
                        routerLink={`/vault/edit/${item.id}`}
                        size="small" fill="clear"
                        className="analysis-fix-btn"
                      >
                        Melhorar
                      </IonButton>
                    </div>
                    <div className="entropy-progress-track">
                      <div className="entropy-progress-fill" style={{
                        width: `${Math.min(100, (item.entropy / 100) * 100)}%`,
                        background: item.strengthColor,
                      }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </IonContent>
    </IonPage>
  );
};
