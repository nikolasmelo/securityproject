import React, { useState, useEffect, useCallback } from 'react';
import {
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonButton,
  IonIcon,
  IonRange,
  IonItem,
  IonLabel,
  IonToggle,
  IonText,
  IonToast,
} from '@ionic/react';
import { copyOutline, refreshOutline, shieldCheckmarkOutline } from 'ionicons/icons';
import { Clipboard } from '@capacitor/clipboard';

interface PasswordGeneratorProps {
  onSelectPassword?: (password: string) => void;
}

export const PasswordGenerator: React.FC<PasswordGeneratorProps> = ({ onSelectPassword }) => {
  const [password, setPassword] = useState('');
  const [length, setLength] = useState(16);
  const [useUppercase, setUseUppercase] = useState(true);
  const [useLowercase, setUseLowercase] = useState(true);
  const [useNumbers, setUseNumbers] = useState(true);
  const [useSymbols, setUseSymbols] = useState(true);
  const [entropy, setEntropy] = useState(0);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  const generatePassword = useCallback(() => {
    let charset = '';
    if (useUppercase) charset += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    if (useLowercase) charset += 'abcdefghijklmnopqrstuvwxyz';
    if (useNumbers) charset += '0123456789';
    if (useSymbols) charset += '!@#$%^&*()_+-=[]{}|;:,.<>?';

    if (!charset) {
      setPassword('');
      setEntropy(0);
      return;
    }

    const array = new Uint32Array(length);
    window.crypto.getRandomValues(array);
    
    let generated = '';
    for (let i = 0; i < length; i++) {
      generated += charset[array[i] % charset.length];
    }

    // Garante variedade: inclui pelo menos um caractere de cada tipo selecionado
    let adjusted = generated.split('');
    const ensureChar = (set: string) => {
      const idx = adjusted.findIndex((c) => set.includes(c));
      if (idx === -1) {
        const randIndex = Math.floor(Math.random() * length);
        const randCharIndex = Math.floor(Math.random() * set.length);
        adjusted[randIndex] = set[randCharIndex];
      }
    };

    if (useUppercase) ensureChar('ABCDEFGHIJKLMNOPQRSTUVWXYZ');
    if (useLowercase) ensureChar('abcdefghijklmnopqrstuvwxyz');
    if (useNumbers) ensureChar('0123456789');
    if (useSymbols) ensureChar('!@#$%^&*()_+-=[]{}|;:,.<>?');

    const finalPass = adjusted.join('');
    setPassword(finalPass);

    // Calcula a pontuação de segurança
    const poolSize = charset.length;
    const computedEntropy = length * Math.log2(poolSize);
    setEntropy(Math.round(computedEntropy));
  }, [length, useUppercase, useLowercase, useNumbers, useSymbols]);

  useEffect(() => {
    generatePassword();
  }, [generatePassword]);

  const copyToClipboard = async () => {
    if (!password) return;
    try {
      await Clipboard.write({ string: password });
      setToastMessage('Senha copiada! Pronta para colar.');
      setShowToast(true);
    } catch (e) {
      console.error(e);
    }
  };

  const getStrengthLabel = () => {
    if (entropy < 40) return { label: 'Muito Fraca ❌', color: '#ff4961', percentage: 20 };
    if (entropy < 60) return { label: 'Fraca ⚠️', color: '#ffc409', percentage: 40 };
    if (entropy < 80) return { label: 'Boa 🛡️', color: '#3dc2ff', percentage: 65 };
    if (entropy < 100) return { label: 'Forte 💪', color: '#2dd36f', percentage: 85 };
    return { label: 'Blindada 🔥', color: '#00e676', percentage: 100 };
  };

  const strength = getStrengthLabel();

  return (
    <IonCard className="glass-card" style={{
      background: 'rgba(255, 255, 255, 0.05)',
      backdropFilter: 'blur(20px)',
      border: '1px solid rgba(255, 255, 255, 0.1)',
      borderRadius: '24px',
      margin: '16px 0',
      boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.3)'
    }}>
      <IonCardHeader style={{ paddingBottom: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <IonIcon icon={shieldCheckmarkOutline} style={{ fontSize: '24px', color: '#3880ff' }} />
          <IonCardTitle style={{ fontSize: '1.2rem', fontWeight: '700', color: '#fff' }}>
            Gerador de Senhas
          </IonCardTitle>
        </div>
      </IonCardHeader>

      <IonCardContent>
        {/* Senha Gerada */}
        <div style={{
          background: 'rgba(0, 0, 0, 0.3)',
          borderRadius: '16px',
          padding: '16px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '16px',
          border: '1px solid rgba(255, 255, 255, 0.05)',
          overflow: 'hidden'
        }}>
          <IonText style={{
            fontFamily: 'monospace',
            fontSize: password.length > 20 ? '1.1rem' : '1.3rem',
            color: '#fff',
            wordBreak: 'break-all',
            flex: '1',
            letterSpacing: '1px',
            userSelect: 'all'
          }}>
            {password || 'Selecione ao menos uma opção'}
          </IonText>
          <div style={{ display: 'flex', gap: '4px', marginLeft: '8px' }}>
            <IonButton fill="clear" color="primary" onClick={generatePassword} style={{ '--padding-start': '8px', '--padding-end': '8px' }}>
              <IonIcon slot="icon-only" icon={refreshOutline} />
            </IonButton>
            <IonButton fill="clear" color="success" onClick={copyToClipboard} style={{ '--padding-start': '8px', '--padding-end': '8px' }}>
              <IonIcon slot="icon-only" icon={copyOutline} />
            </IonButton>
          </div>
        </div>

        {/* Indicador de Força & Entropia */}
        <div style={{ marginBottom: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
            <IonText style={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '0.85rem' }}>
              Segurança: <span style={{ color: strength.color, fontWeight: '700' }}>{strength.label}</span>
            </IonText>
            <IonText style={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '0.85rem' }}>
              Pontuação: <span style={{ color: '#fff', fontWeight: 'bold' }}>{entropy} pontos</span>
            </IonText>
          </div>
          <div style={{
            height: '6px',
            background: 'rgba(255, 255, 255, 0.1)',
            borderRadius: '3px',
            overflow: 'hidden'
          }}>
            <div style={{
              height: '100%',
              width: `${strength.percentage}%`,
              background: strength.color,
              transition: 'width 0.3s ease, background-color 0.3s ease'
            }} />
          </div>
        </div>

        {/* Configurações do Gerador */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ padding: '0 8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#fff', marginBottom: '2px' }}>
              <span style={{ fontSize: '0.9rem', fontWeight: '600' }}>Quantidade de caracteres</span>
              <span style={{ fontSize: '0.9rem', fontWeight: 'bold', color: '#3880ff' }}>{length}</span>
            </div>
            <IonRange
              min={8}
              max={64}
              value={length}
              onIonInput={(e) => setLength(e.detail.value as number)}
              style={{ '--knob-background': '#3880ff', '--bar-background': 'rgba(255, 255, 255, 0.1)', '--bar-background-active': '#3880ff' }}
            />
          </div>

          <IonItem lines="none" style={{ '--background': 'transparent', '--color': '#fff' }}>
            <IonLabel style={{ fontSize: '0.95rem' }}>Maiúsculas (A-Z)</IonLabel>
            <IonToggle checked={useUppercase} onIonChange={(e) => setUseUppercase(e.detail.checked)} slot="end" />
          </IonItem>

          <IonItem lines="none" style={{ '--background': 'transparent', '--color': '#fff' }}>
            <IonLabel style={{ fontSize: '0.95rem' }}>Minúsculas (a-z)</IonLabel>
            <IonToggle checked={useLowercase} onIonChange={(e) => setUseLowercase(e.detail.checked)} slot="end" />
          </IonItem>

          <IonItem lines="none" style={{ '--background': 'transparent', '--color': '#fff' }}>
            <IonLabel style={{ fontSize: '0.95rem' }}>Números (0-9)</IonLabel>
            <IonToggle checked={useNumbers} onIonChange={(e) => setUseNumbers(e.detail.checked)} slot="end" />
          </IonItem>

          <IonItem lines="none" style={{ '--background': 'transparent', '--color': '#fff' }}>
            <IonLabel style={{ fontSize: '0.95rem' }}>Símbolos (!@#$)</IonLabel>
            <IonToggle checked={useSymbols} onIonChange={(e) => setUseSymbols(e.detail.checked)} slot="end" />
          </IonItem>
        </div>

        {onSelectPassword && (
          <IonButton
            expand="block"
            onClick={() => onSelectPassword(password)}
            disabled={!password}
            style={{
              marginTop: '20px',
              '--background': 'linear-gradient(135deg, #3880ff 0%, #1e57c6 100%)',
              '--border-radius': '14px',
              fontWeight: '600'
            }}
          >
            Usar esta Senha
          </IonButton>
        )}
      </IonCardContent>

      <IonToast
        isOpen={showToast}
        onDidDismiss={() => setShowToast(false)}
        message={toastMessage}
        duration={2000}
        color="dark"
        position="bottom"
      />
    </IonCard>
  );
};
