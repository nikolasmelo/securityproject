import React, { useState, useEffect } from 'react';
import { 
  IonPage, 
  IonContent, 
  IonCard, 
  IonCardContent, 
  IonItem, 
  IonLabel, 
  IonInput, 
  IonButton, 
  IonIcon, 
  IonSpinner
} from '@ionic/react';
import { 
  shieldCheckmarkOutline, 
  eyeOutline, 
  eyeOffOutline, 
  keyOutline, 
  checkmarkCircleOutline, 
  closeCircleOutline, 
  warningOutline, 
  lockClosedOutline
} from 'ionicons/icons';
import { useSecurity } from '../../contexts/SecurityContext';
import { StorageService } from '../../services/storage';
import { SessionService } from '../../services/session';
import { SplineScene } from '../../components/ui/splite';
import { SpotlightHover } from '../../components/ui/spotlight-hover';
import './AuthPage.css';

export const AuthPage: React.FC = () => {
  const { register, login, login2FA } = useSecurity();
  
  // Modos: 'LOADING' | 'REGISTER' | 'LOGIN' | 'TOTP_VERIFY'
  const [mode, setMode] = useState<'LOADING' | 'REGISTER' | 'LOGIN' | 'TOTP_VERIFY'>('LOADING');
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [totpToken, setTotpToken] = useState<string>('');
  
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [lockoutSecs, setLockoutSecs] = useState<number>(0);
  const [splineLoaded, setSplineLoaded] = useState<boolean>(false);
  const [showLoginForm, setShowLoginForm] = useState<boolean>(false);

  const handleSplineLoad = () => {
    setSplineLoaded(true);
    setTimeout(() => {
      setShowLoginForm(true);
    }, 1000); // Exibe o formulário após 1 segundo que o robô terminar de renderizar
  };

  // Requisitos da senha mestra para validação em tempo real
  const [pwdReqs, setPwdReqs] = useState({
    length: false,
    upper: false,
    lower: false,
    number: false,
    special: false
  });

  // Checa se existe qualquer conta no dispositivo para definir se exibe Cadastro ou Login
  useEffect(() => {
    async function checkUserExistence() {
      const hasAccounts = await StorageService.hasAnyAccount();
      if (hasAccounts) {
        setMode('LOGIN');
      } else {
        setMode('REGISTER');
      }
    }
    checkUserExistence();
  }, []);

  // Escuta força bruta do login
  useEffect(() => {
    let interval: any = null;

    const checkLock = async () => {
      const lockout = await SessionService.checkLockout();
      if (lockout.isLocked) {
        setLockoutSecs(lockout.remainingSeconds);
        setErrorMsg(lockout.message || 'Defesa contra Força Bruta ativa.');
      } else {
        if (lockoutSecs > 0) {
          setLockoutSecs(0);
          setErrorMsg(null);
        }
      }
    };

    if (mode === 'LOGIN') {
      checkLock();
      interval = setInterval(checkLock, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [mode, lockoutSecs]);

  // Valida a força da senha em tempo real
  const handlePasswordChange = (val: string) => {
    setPassword(val);
    setPwdReqs({
      length: val.length >= 12,
      upper: /[A-Z]/.test(val),
      lower: /[a-z]/.test(val),
      number: /[0-9]/.test(val),
      special: /[!@#$%^&*(),.?":{}|<>]/.test(val)
    });
  };

  const isPasswordValid = () => {
    return pwdReqs.length && pwdReqs.upper && pwdReqs.lower && pwdReqs.number && pwdReqs.special;
  };

  // Cadastro do usuário local
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!email.trim()) {
      setErrorMsg('Por favor, informe um e-mail ou nome de usuário.');
      return;
    }

    if (!isPasswordValid()) {
      setErrorMsg('A senha não cumpre todos os requisitos de segurança.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMsg('As senhas não coincidem.');
      return;
    }

    setLoading(true);
    setTimeout(async () => {
      const res = await register(email, password);
      setLoading(false);
      if (res.success) {
        setSuccessMsg('Conta criada com sucesso! Carregando cofre...');
      } else {
        setErrorMsg(res.error || 'Erro ao registrar.');
      }
    }, 500);
  };

  // Login do usuário local
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!email.trim()) {
      setErrorMsg('Digite o seu E-mail ou Usuário.');
      return;
    }

    if (!password) {
      setErrorMsg('Digite a sua Senha Mestra.');
      return;
    }

    setLoading(true);
    setTimeout(async () => {
      const res = await login(email, password);
      setLoading(false);
      if (res.success) {
        if ('requires2FA' in res && res.requires2FA) {
          setMode('TOTP_VERIFY');
        } else {
          setSuccessMsg('Autenticação bem-sucedida! Entrando...');
        }
      } else {
        setErrorMsg(res.error || 'Senha incorreta.');
      }
    }, 600);
  };

  // Validação de 2FA TOTP
  const handleVerify2FA = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    
    if (totpToken.length !== 6 || isNaN(Number(totpToken))) {
      setErrorMsg('O código deve conter 6 dígitos.');
      return;
    }

    setLoading(true);
    setTimeout(async () => {
      const activeEmail = SessionService.getActiveUserEmail();
      if (activeEmail) {
        const res = await login2FA(totpToken);
        setLoading(false);
        if (res.success) {
          setSuccessMsg('Token 2FA verificado! Acesso liberado.');
          window.location.reload();
        } else {
          setErrorMsg('Código 2FA incorreto ou expirado. Tente novamente.');
        }
      } else {
        setLoading(false);
        setErrorMsg('Erro interno de configuração de 2FA.');
      }
    }, 400);
  };

  if (mode === 'LOADING') {
    return (
      <IonPage>
        <IonContent className="auth-loading-content ion-padding">
          <div className="auth-loading-container">
            <IonSpinner name="crescent" color="primary" />
            <p>Carregando chaves seguras...</p>
          </div>
        </IonContent>
      </IonPage>
    );
  }

  return (
    <IonPage>
      <IonContent className="auth-content">
        
        {/* Fundo com cabeça do robô gigante e spotlight seguindo o mouse */}
        <div className="spline-background">
          <SpotlightHover className="from-blue-600/10 via-indigo-600/5 to-transparent" size={500} />
          <SplineScene 
            scene="https://prod.spline.design/kZDDjO5HuC9GJUM2/scene.splinecode"
            className="spline-element"
            onLoad={handleSplineLoad}
          />
        </div>

        {/* Formulário Centralizado por cima da cabeça interativa */}
        <div className="login-overlay">
          <div className={`transition-all duration-1000 transform ${showLoginForm ? 'opacity-100 translate-y-0 scale-100 pointer-events-auto' : 'opacity-0 translate-y-12 scale-95 pointer-events-none'} flex items-center justify-center w-full max-w-md`}>
            <div className="w-full">
              <div className="auth-header ion-text-center">
                <IonIcon icon={shieldCheckmarkOutline} className="auth-logo-icon" />
                <h1 className="text-2xl font-black">Cofre de Segurança Local</h1>
                <p className="auth-subtitle">Seu gerenciador de senhas ultrasseguro e offline</p>
              </div>

              <IonCard className="auth-card glass-card">
                <IonCardContent className="auth-card-content">
                  {errorMsg && (
                    <div className="auth-alert error">
                      <IonIcon icon={warningOutline} className="alert-icon" />
                      <span>{errorMsg}</span>
                    </div>
                  )}

                  {successMsg && (
                    <div className="auth-alert success">
                      <IonIcon icon={checkmarkCircleOutline} className="alert-icon" />
                      <span>{successMsg}</span>
                    </div>
                  )}

                  {mode === 'REGISTER' && (
                    <form onSubmit={handleRegister} className="auth-form animate-fade-in">
                      <h2>Criar Meu Cofre Seguro</h2>
                      <p className="form-info-text">
                        Escolha seu e-mail e crie uma <strong>Senha Mestra forte</strong>. Ela protege todas as suas credenciais com criptografia de ponta e nunca sai do seu aparelho.
                      </p>

                      <div className="zk-badge">
                        <IonIcon icon={lockClosedOutline} />
                        <span>Privacidade Total: Nós não guardamos nem temos acesso às suas senhas.</span>
                      </div>

                      <IonItem className="auth-input-item" lines="none">
                        <IonLabel position="stacked">E-mail ou Usuário</IonLabel>
                        <IonInput
                          type="text"
                          placeholder="Ex: aluno@tcc.com"
                          value={email}
                          onIonInput={(e) => setEmail(e.detail.value!)}
                          required
                          disabled={loading}
                        />
                      </IonItem>

                      <IonItem className="auth-input-item" lines="none">
                        <IonLabel position="stacked">Senha Mestra</IonLabel>
                        <IonInput
                          type={showPassword ? 'text' : 'password'}
                          placeholder="Mínimo 12 caracteres complexos"
                          value={password}
                          onIonInput={(e) => handlePasswordChange(e.detail.value!)}
                          required
                          disabled={loading}
                        />
                        <IonButton
                          slot="end"
                          fill="clear"
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          style={{ '--padding-start': '4px', '--padding-end': '4px', marginTop: '24px' }}
                        >
                          <IonIcon icon={showPassword ? eyeOffOutline : eyeOutline} style={{ color: '#64748b', fontSize: '22px' }} />
                        </IonButton>
                      </IonItem>

                      {/* Requisitos Dinâmicos de Senha Forte */}
                      <div className="password-strength-checker">
                        <div className={`req-item ${pwdReqs.length ? 'met' : ''}`}>
                          <IonIcon icon={pwdReqs.length ? checkmarkCircleOutline : closeCircleOutline} />
                          <span>Ter pelo menos 12 caracteres</span>
                        </div>
                        <div className={`req-item ${pwdReqs.upper ? 'met' : ''}`}>
                          <IonIcon icon={pwdReqs.upper ? checkmarkCircleOutline : closeCircleOutline} />
                          <span>Conter letra maiúscula (A-Z)</span>
                        </div>
                        <div className={`req-item ${pwdReqs.lower ? 'met' : ''}`}>
                          <IonIcon icon={pwdReqs.lower ? checkmarkCircleOutline : closeCircleOutline} />
                          <span>Conter letra minúscula (a-z)</span>
                        </div>
                        <div className={`req-item ${pwdReqs.number ? 'met' : ''}`}>
                          <IonIcon icon={pwdReqs.number ? checkmarkCircleOutline : closeCircleOutline} />
                          <span>Conter pelo menos um número (0-9)</span>
                        </div>
                        <div className={`req-item ${pwdReqs.special ? 'met' : ''}`}>
                          <IonIcon icon={pwdReqs.special ? checkmarkCircleOutline : closeCircleOutline} />
                          <span>Conter caractere especial (@, #, $...)</span>
                        </div>
                      </div>

                      <IonItem className="auth-input-item" lines="none">
                        <IonLabel position="stacked">Confirme a Senha Mestra</IonLabel>
                        <IonInput
                          type={showPassword ? 'text' : 'password'}
                          placeholder="Repita a senha mestre criada"
                          value={confirmPassword}
                          onIonInput={(e) => setConfirmPassword(e.detail.value!)}
                          required
                          disabled={loading}
                        />
                      </IonItem>

                      <div className="warning-zk-critical">
                        <IonIcon icon={warningOutline} color="warning" />
                        <p>
                          <strong>Atenção:</strong> Por motivos de segurança, não armazenamos sua Senha Mestra. Ela é irrecuperável se esquecida. Guarde-a com cuidado!
                        </p>
                      </div>

                      <IonButton 
                        type="submit" 
                        expand="block" 
                        className="btn-auth-submit"
                        disabled={!isPasswordValid() || loading}
                      >
                        {loading ? <IonSpinner name="crescent" /> : 'Criar Meu Cofre Seguro'}
                      </IonButton>

                      <IonButton 
                        fill="clear" 
                        expand="block" 
                        color="medium" 
                        style={{ marginTop: '12px' }}
                        onClick={() => {
                          setMode('LOGIN');
                          setPassword('');
                          setConfirmPassword('');
                          setErrorMsg(null);
                          setSuccessMsg(null);
                        }}
                      >
                        Já tem um cofre neste aparelho? Acessar Cofre
                      </IonButton>
                    </form>
                  )}

                  {mode === 'LOGIN' && (
                    <form onSubmit={handleLogin} className="auth-form animate-fade-in">
                      <h2>Acessar Meu Cofre</h2>
                      <p className="form-info-text">
                        Digite seu e-mail e sua Senha Mestra para decifrar e visualizar suas credenciais salvas.
                      </p>

                      <IonItem className="auth-input-item" lines="none">
                        <IonLabel position="stacked">E-mail ou Usuário</IonLabel>
                        <IonInput
                          type="text"
                          placeholder="Digite seu e-mail"
                          value={email}
                          onIonInput={(e) => setEmail(e.detail.value!)}
                          required
                          disabled={loading || lockoutSecs > 0}
                        />
                      </IonItem>

                      <IonItem className="auth-input-item" lines="none">
                        <IonLabel position="stacked">Senha Mestra</IonLabel>
                        <IonInput
                          type={showPassword ? 'text' : 'password'}
                          placeholder="Digite sua senha mestra"
                          value={password}
                          onIonInput={(e) => setPassword(e.detail.value!)}
                          required
                          disabled={loading || lockoutSecs > 0}
                        />
                        <IonButton
                          slot="end"
                          fill="clear"
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          style={{ '--padding-start': '4px', '--padding-end': '4px', marginTop: '24px' }}
                        >
                          <IonIcon icon={showPassword ? eyeOffOutline : eyeOutline} style={{ color: '#64748b', fontSize: '22px' }} />
                        </IonButton>
                      </IonItem>

                      {lockoutSecs > 0 ? (
                        <div className="brute-force-lockout">
                          <IonIcon icon={warningOutline} color="danger" />
                          <p>
                            Acesso bloqueado por segurança devido a tentativas incorretas. 
                            Aguarde <strong>{lockoutSecs}</strong> segundos.
                          </p>
                        </div>
                      ) : (
                        <IonButton 
                          type="submit" 
                          expand="block" 
                          className="btn-auth-submit"
                          disabled={loading}
                        >
                          {loading ? <IonSpinner name="crescent" /> : 'Desbloquear Agora'}
                        </IonButton>
                      )}

                      <IonButton 
                        fill="clear" 
                        expand="block" 
                        color="medium" 
                        style={{ marginTop: '12px' }}
                        onClick={() => {
                          setMode('REGISTER');
                          setPassword('');
                          setConfirmPassword('');
                          setErrorMsg(null);
                          setSuccessMsg(null);
                        }}
                      >
                        Novo por aqui? Criar meu cofre seguro
                      </IonButton>
                    </form>
                  )}

                  {mode === 'TOTP_VERIFY' && (
                    <form onSubmit={handleVerify2FA} className="auth-form animate-fade-in">
                      <div className="totp-icon-header">
                        <IonIcon icon={keyOutline} className="totp-key-icon" />
                      </div>
                      <h2>Verificação em Duas Etapas (2FA)</h2>
                      <p className="form-info-text">
                        Sua conta possui proteção extra de <strong>Duas Etapas</strong>. 
                        Digite o código de 6 dígitos gerado no seu aplicativo autenticador.
                      </p>

                      <IonItem className="auth-input-item" lines="none">
                        <IonLabel position="stacked">Código 2FA de 6 dígitos</IonLabel>
                        <IonInput
                          type="text"
                          inputmode="numeric"
                          maxlength={6}
                          placeholder="Digite o código"
                          value={totpToken}
                          onIonInput={(e) => setTotpToken(e.detail.value!)}
                          required
                          disabled={loading}
                          className="totp-numeric-input"
                        />
                      </IonItem>

                      <IonButton 
                        type="submit" 
                        expand="block" 
                        className="btn-auth-submit"
                        disabled={loading || totpToken.length !== 6}
                      >
                        {loading ? <IonSpinner name="crescent" /> : 'Confirmar Código'}
                      </IonButton>

                      <IonButton 
                        fill="clear" 
                        expand="block" 
                        color="medium" 
                        onClick={() => {
                          setMode('LOGIN');
                          setPassword('');
                          setTotpToken('');
                        }}
                      >
                        Voltar
                      </IonButton>
                    </form>
                  )}
                </IonCardContent>
              </IonCard>
            </div>
          </div>
        </div>

      </IonContent>
    </IonPage>
  );
};

export default AuthPage;
