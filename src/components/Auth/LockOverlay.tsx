import React, { useState, useEffect } from 'react';
import { 
  IonContent, 
  IonButton, 
  IonIcon, 
  IonText,
  IonSpinner
} from '@ionic/react';
import { lockClosedOutline, fingerPrintOutline, backspaceOutline, logOutOutline } from 'ionicons/icons';
import { useSecurity } from '../../contexts/SecurityContext';
import { SessionService } from '../../services/session';
import './LockOverlay.css';

export const LockOverlay: React.FC = () => {
  const { unlockWithPIN, unlockWithBiometrics, logout, isLocked, hasPIN } = useSecurity();
  const [pin, setPin] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [lockoutSecs, setLockoutSecs] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);

  // Verifica proteção contra tentativas repetidas ao montar
  useEffect(() => {
    let interval: any = null;

    const checkLock = async () => {
      const lockout = await SessionService.checkLockout();
      if (lockout.isLocked) {
        setLockoutSecs(lockout.remainingSeconds);
        setPin('');
      } else {
        setLockoutSecs(0);
      }
    };

    if (isLocked) {
      checkLock();
      interval = setInterval(checkLock, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isLocked]);

  if (!isLocked) return null;

  const handleKeyPress = (num: string) => {
    if (lockoutSecs > 0 || loading) return;
    setErrorMsg(null);
    if (pin.length < 6) {
      const newPin = pin + num;
      setPin(newPin);
      if (newPin.length === 6) {
        submitPIN(newPin);
      }
    }
  };

  const handleBackspace = () => {
    if (lockoutSecs > 0 || loading) return;
    setErrorMsg(null);
    if (pin.length > 0) {
      setPin(pin.slice(0, -1));
    }
  };

  const submitPIN = async (pinCode: string) => {
    setLoading(true);
    // Pequeno delay para feedback visual suave
    setTimeout(async () => {
      const res = await unlockWithPIN(pinCode);
      setLoading(false);
      if (!res.success) {
        setErrorMsg(res.error || 'PIN incorreto. Tente novamente.');
        setPin('');
      }
    }, 400);
  };

  const handleBiometrics = async () => {
    if (lockoutSecs > 0 || loading) return;
    setErrorMsg(null);
    const success = await unlockWithBiometrics();
    if (!success) {
      setErrorMsg('Não foi possível verificar sua identidade. Tente novamente.');
    }
  };

  return (
    <div className="lock-overlay-container">
      <div className="lock-overlay-header">
        <IonIcon icon={lockClosedOutline} className="lock-icon-main pulse" />
        <h2>Seu cofre está protegido</h2>
        <p>Digite seu PIN de 6 dígitos ou use a biometria para continuar.</p>
      </div>

      <div className="pin-indicator-container">
        {[...Array(6)].map((_, i) => (
          <div 
            key={i} 
            className={`pin-dot ${i < pin.length ? 'filled' : ''} ${errorMsg ? 'error' : ''}`}
          />
        ))}
      </div>

      {errorMsg && (
        <div className="lock-error-container">
          <IonText color="danger"><p className="shake">{errorMsg}</p></IonText>
        </div>
      )}

      {lockoutSecs > 0 && (
        <div className="lockout-timer-container">
          <p>Muitas tentativas. Aguarde um momento.</p>
          <h3>{Math.floor(lockoutSecs / 60)}:{(lockoutSecs % 60).toString().padStart(2, '0')}</h3>
        </div>
      )}

      {loading && (
        <div className="lock-spinner">
          <IonSpinner name="crescent" color="primary" />
        </div>
      )}

      <div className="numeric-keypad">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(num => (
          <button 
            key={num} 
            className="keypad-button"
            disabled={lockoutSecs > 0 || loading}
            onClick={() => handleKeyPress(num)}
          >
            {num}
          </button>
        ))}

        <button 
          className="keypad-button functional-key"
          disabled={lockoutSecs > 0 || loading}
          onClick={handleBiometrics}
        >
          <IonIcon icon={fingerPrintOutline} />
        </button>

        <button 
          className="keypad-button"
          disabled={lockoutSecs > 0 || loading}
          onClick={() => handleKeyPress('0')}
        >
          0
        </button>

        <button 
          className="keypad-button functional-key"
          disabled={lockoutSecs > 0 || loading}
          onClick={handleBackspace}
        >
          <IonIcon icon={backspaceOutline} />
        </button>
      </div>

      <div className="lock-overlay-footer">
        <IonButton fill="clear" color="medium" onClick={logout}>
          <IonIcon slot="start" icon={logOutOutline} />
          Sair da Conta
        </IonButton>
      </div>
    </div>
  );
};
