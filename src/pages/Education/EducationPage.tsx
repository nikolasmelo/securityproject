import React, { useState } from 'react';
import {
  IonPage, IonHeader, IonToolbar, IonTitle, IonContent,
  IonCard, IonCardContent, IonCardHeader, IonCardTitle,
  IonButton, IonIcon, IonInput, IonItem, IonToast,
  IonBadge, IonSegment, IonSegmentButton, IonLabel,
} from '@ionic/react';
import {
  shieldOutline, alertCircleOutline, checkmarkCircleOutline,
  bookOutline, helpCircleOutline, globeOutline, warningOutline,
  schoolOutline, lockClosedOutline, fingerPrintOutline,
} from 'ionicons/icons';
import './EducationPage.css';

// ────────────────────────────────────────
// Base local de domínios suspeitos (LGPD / phishing comum)
// ────────────────────────────────────────
const SUSPICIOUS_PATTERNS = [
  'paypal-secure', 'itau-login', 'bradesco-acesso', 'banco-seguro',
  'conta-bloqueada', 'atualizar-dados', 'verify-account',
  'netflix-payment', 'amazon-prize', 'whatsapp-gold',
  'instagram-verified', 'gov-br-cpf', 'receita-federal-pgto',
];

const SUSPICIOUS_TLDS = ['.xyz', '.click', '.tk', '.pw', '.cc', '.loan', '.work'];

function analyzeUrl(url: string): { safe: boolean; warnings: string[]; score: number } {
  const warnings: string[] = [];
  const lower = url.toLowerCase().replace(/https?:\/\//, '');

  if (!url.startsWith('https://')) warnings.push('Inseguro: Este site não utiliza conexão criptografada (HTTPS).');
  if (lower.includes('@')) warnings.push('Alerta: O link utiliza caracteres especiais de disfarce comuns em golpes.');
  if ((lower.match(/\./g) || []).length > 4) warnings.push('Aviso: Há muitos subdomínios no link, indicando endereço suspeito.');
  if (/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/.test(lower)) warnings.push('Perigo: O link aponta para um endereço de IP direto, tática frequente de clonagem.');
  SUSPICIOUS_PATTERNS.forEach(p => { if (lower.includes(p)) warnings.push(`Alerta: Encontramos um termo comumente usado em fraudes ("${p}").`); });
  SUSPICIOUS_TLDS.forEach(t => { if (lower.endsWith(t) || lower.includes(t + '/')) warnings.push(`Aviso: A extensão de domínio utilizada ("${t}") é muito usada em golpes.`); });
  if (lower.includes('login') && !['google.com', 'microsoft.com', 'apple.com', 'gov.br'].some(d => lower.includes(d))) {
    warnings.push('Perigo: Tela de login detectada em endereço não confiável.');
  }

  const score = Math.max(0, 100 - warnings.length * 25);
  return { safe: warnings.length === 0, warnings, score };
}

// ────────────────────────────────────────
// Conteúdo educativo
// ────────────────────────────────────────
const TIPS = [
  { icon: lockClosedOutline, color: '#3880ff', title: 'Uma senha para cada conta', text: 'Se você repete senhas, um único vazamento pode expor todas as suas contas. Crie e guarde senhas únicas e fortes no seu cofre pessoal.' },
  { icon: fingerPrintOutline, color: '#2dd36f', title: 'Dupla Proteção (2FA)', text: 'A verificação em duas etapas é um escudo extra. Mesmo que alguém descubra sua senha, precisará do código de acesso temporário gerado no seu celular.' },
  { icon: alertCircleOutline, color: '#ffc409', title: 'Cuidado com links falsos', text: 'Desconfie de mensagens urgentes que solicitam dados bancários ou pessoais. Golpistas costumam imitar marcas famosas para roubar informações.' },
  { icon: shieldOutline, color: '#9c27b0', title: 'Sua privacidade é garantida', text: 'A LGPD assegura que você tem total controle sobre seus dados pessoais. Você pode solicitar a remoção ou correção das suas informações em empresas brasileiras.' },
  { icon: globeOutline, color: '#ff4961', title: 'Atenção em redes públicas de Wi-Fi', text: 'Redes Wi-Fi públicas de cafeterias ou aeroportos podem ser interceptadas. Para transações e e-mails importantes, prefira seus dados móveis (4G/5G).' },
  { icon: bookOutline, color: '#3dc2ff', title: 'Celular sempre atualizado', text: 'Atualizar o sistema e seus aplicativos elimina falhas de segurança conhecidas. Ative as atualizações automáticas do aparelho para proteção constante.' },
];

const QUIZ = [
  {
    q: 'O que é um golpe de phishing?',
    opts: ['Um vírus de computador comum', 'Um golpe com links ou e-mails falsos para roubar dados confidenciais', 'Tentativa de adivinhar sua senha mestra', 'Problemas com o sinal de internet'],
    correct: 1,
    explain: 'Golpes de phishing fingem ser comunicações legítimas para enganar você e obter credenciais ou dados sigilosos.',
  },
  {
    q: 'Qual o tamanho recomendado para uma senha segura?',
    opts: ['Pelo menos 6 caracteres', 'Pelo menos 8 caracteres', 'No mínimo 12 a 16 caracteres', 'Apenas 4 números'],
    correct: 2,
    explain: 'Senhas longas (a partir de 12 caracteres) tornam o trabalho de invasores praticamente impossível usando computadores convencionais.',
  },
  {
    q: 'O que indica o "https://" no início do endereço de um site?',
    opts: ['Indica que o site é do governo', 'Garante que os dados enviados ao site viajam criptografados e protegidos', 'Significa que o site é totalmente imune a golpes', 'Significa que o site não armazena cookies'],
    correct: 1,
    explain: 'O HTTPS garante uma conexão segura e criptografada entre você e o site, impedindo que outros vejam o que você está enviando.',
  },
  {
    q: 'Quais são seus direitos segundo a LGPD?',
    opts: ['Usar internet gratuita em locais públicos', 'Visualizar, corrigir e pedir para excluir seus dados pessoais das empresas', 'Proteção automática e gratuita contra vírus', 'Garantia de que senhas nunca expiram'],
    correct: 1,
    explain: 'A Lei Geral de Proteção de Dados (LGPD) devolve a você o controle sobre as suas próprias informações pessoais coletadas por empresas.',
  },
];

export const EducationPage: React.FC = () => {
  const [segment, setSegment] = useState<'tips' | 'phishing' | 'quiz'>('tips');
  const [urlInput, setUrlInput] = useState('');
  const [urlResult, setUrlResult] = useState<ReturnType<typeof analyzeUrl> | null>(null);
  const [quizIndex, setQuizIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [quizDone, setQuizDone] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMsg, setToastMsg] = useState('');

  const handleAnalyze = () => {
    if (!urlInput.trim()) return;
    setUrlResult(analyzeUrl(urlInput.trim()));
  };

  const handleAnswer = (optIdx: number) => {
    if (selected !== null) return;
    setSelected(optIdx);
    const correct = QUIZ[quizIndex].correct === optIdx;
    if (correct) setScore(s => s + 1);
  };

  const handleNext = () => {
    if (quizIndex + 1 >= QUIZ.length) {
      setQuizDone(true);
    } else {
      setQuizIndex(i => i + 1);
      setSelected(null);
    }
  };

  const resetQuiz = () => { setQuizIndex(0); setSelected(null); setScore(0); setQuizDone(false); };

  return (
    <IonPage className="education-page">
      <IonHeader className="ion-no-border">
        <IonToolbar className="education-toolbar">
          <IonTitle className="education-title">📚 Central de Aprendizado</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent className="education-content">
        <div className="education-header-container">
          <IonSegment
            value={segment}
            onIonChange={e => setSegment(e.detail.value as any)}
            className="education-segment"
          >
            {[
              { val: 'tips', label: '💡 Dicas' },
              { val: 'phishing', label: '🔎 Detector de Links' },
              { val: 'quiz', label: '🧠 Quiz de Privacidade' },
            ].map(s => (
              <IonSegmentButton key={s.val} value={s.val} className="education-segment-btn">
                <IonLabel>{s.label}</IonLabel>
              </IonSegmentButton>
            ))}
          </IonSegment>
        </div>

        <div className="education-tab-container">

          {/* ── DICAS ── */}
          {segment === 'tips' && TIPS.map((tip, i) => (
            <IonCard key={i} className="tip-card">
              <IonCardContent className="tip-card-content">
                <div className="tip-icon-wrapper" style={{ background: `${tip.color}15` }}>
                  <IonIcon icon={tip.icon} style={{ fontSize: '24px', color: tip.color }} />
                </div>
                <div>
                  <h3 className="tip-title">{tip.title}</h3>
                  <p className="tip-desc">{tip.text}</p>
                </div>
              </IonCardContent>
            </IonCard>
          ))}

          {/* ── VERIFICADOR ANTI-PHISHING ── */}
          {segment === 'phishing' && (
            <>
              <IonCard className="phishing-card">
                <IonCardHeader>
                  <div className="hardening-card-title-row">
                    <IonIcon icon={globeOutline} style={{ color: '#3b82f6', fontSize: '24px' }} />
                    <IonCardTitle className="hardening-card-title">
                      Detector de Links Perigosos
                    </IonCardTitle>
                  </div>
                </IonCardHeader>
                <IonCardContent style={{ padding: '0 20px 20px' }}>
                  <p className="hardening-card-desc">
                    Cole o link recebido por WhatsApp, e-mail ou SMS para verificar instantaneamente se ele é seguro.
                  </p>
                  <IonItem lines="none" className="phishing-input-item">
                    <IonIcon icon={globeOutline} slot="start" style={{ color: '#3b82f6', fontSize: '20px' }} />
                    <IonInput
                      value={urlInput}
                      onIonInput={e => setUrlInput(e.detail.value ?? '')}
                      placeholder="https://exemplo.com/login"
                    />
                  </IonItem>
                  <IonButton expand="block" onClick={handleAnalyze} disabled={!urlInput.trim()} className="cyber-btn" color="primary">
                    Verificar Link
                  </IonButton>
                </IonCardContent>
              </IonCard>

              {urlResult && (
                <IonCard className={`phishing-result-card ${urlResult.safe ? 'safe' : 'unsafe'}`}>
                  <IonCardContent style={{ padding: '20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                      <IonIcon
                        icon={urlResult.safe ? checkmarkCircleOutline : alertCircleOutline}
                        style={{ fontSize: '30px', color: urlResult.safe ? '#10b981' : '#ef4444' }}
                      />
                      <div>
                        <div style={{ color: urlResult.safe ? '#10b981' : '#ef4444', fontWeight: '900', fontSize: '1.15rem', letterSpacing: '-0.3px' }}>
                          {urlResult.safe ? 'Link Seguro' : 'Link Altamente Suspeito!'}
                        </div>
                        <div style={{ color: '#94a3b8', fontSize: '0.82rem', fontWeight: '600' }}>
                          Pontuação de segurança: {urlResult.score}/100
                        </div>
                      </div>
                    </div>
                    {urlResult.warnings.length > 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {urlResult.warnings.map((w, i) => (
                          <div key={i} className="phishing-warning-item">
                            <IonIcon icon={warningOutline} style={{ color: '#ef4444', flexShrink: 0, marginTop: '2px', fontSize: '16px' }} />
                            <span style={{ color: '#fca5a5', fontSize: '0.85rem', fontWeight: '500' }}>{w}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </IonCardContent>
                </IonCard>
              )}
            </>
          )}

          {/* ── QUIZ ── */}
          {segment === 'quiz' && (
            <IonCard className="quiz-card">
              <IonCardContent style={{ padding: '20px' }}>
                {quizDone ? (
                  <div style={{ textAlign: 'center', padding: '20px 0' }}>
                    <div style={{ fontSize: '3.8rem', marginBottom: '14px' }}>
                      {score === QUIZ.length ? '🏆' : score >= 2 ? '🥇' : '📚'}
                    </div>
                    <div style={{ color: '#f1f5f9', fontSize: '1.35rem', fontWeight: '900', letterSpacing: '-0.3px' }}>
                      {score}/{QUIZ.length} acertos
                    </div>
                    <div style={{ color: '#94a3b8', marginTop: '8px', marginBottom: '28px', fontSize: '0.92rem', fontWeight: '500', lineHeight: '1.5' }}>
                      {score === QUIZ.length ? 'Perfeito! Você tem excelentes hábitos de segurança!' : score >= 2 ? 'Muito bem! Continue estudando para se manter protegido.' : 'Dica: Dê uma olhada na aba Dicas e tente novamente.'}
                    </div>
                    <IonButton expand="block" onClick={resetQuiz} className="cyber-btn" color="primary">
                      Fazer o Quiz Novamente
                    </IonButton>
                  </div>
                ) : (
                  <>
                    <div className="quiz-header-row">
                      <span style={{ color: '#94a3b8', fontSize: '0.82rem' }}>
                        Pergunta {quizIndex + 1} de {QUIZ.length}
                      </span>
                      <span style={{ color: '#3b82f6', fontSize: '0.82rem' }}>
                        {score} acertos
                      </span>
                    </div>

                    <div className="quiz-progress-track">
                      <div className="quiz-progress-fill" style={{ width: `${((quizIndex) / QUIZ.length) * 100}%` }} />
                    </div>

                    <h3 className="quiz-question">
                      {QUIZ[quizIndex].q}
                    </h3>

                    <div className="quiz-options-list">
                      {QUIZ[quizIndex].opts.map((opt, i) => {
                        const isCorrect = i === QUIZ[quizIndex].correct;
                        const isSelected = i === selected;
                        let optionClass = '';
                        if (selected !== null) {
                          if (isCorrect) optionClass = 'correct';
                          else if (isSelected) optionClass = 'incorrect';
                          else optionClass = 'disabled';
                        }
                        return (
                          <div key={i} onClick={() => handleAnswer(i)} className={`quiz-option-btn ${optionClass}`}>
                            <span>{opt}</span>
                          </div>
                        );
                      })}
                    </div>

                    {selected !== null && (
                      <>
                        <div className="quiz-explanation-box">
                          <p>
                            💡 <strong style={{ color: '#60a5fa' }}>Explicação:</strong> {QUIZ[quizIndex].explain}
                          </p>
                        </div>
                        <IonButton expand="block" onClick={handleNext} className="cyber-btn" color="primary" style={{ marginTop: '16px' }}>
                          {quizIndex + 1 < QUIZ.length ? 'Avançar →' : 'Ver Meu Resultado 🏆'}
                        </IonButton>
                      </>
                    )}
                  </>
                )}
              </IonCardContent>
            </IonCard>
          )}
        </div>

        <IonToast isOpen={showToast} onDidDismiss={() => setShowToast(false)} message={toastMsg} duration={2000} color="dark" position="bottom" />
      </IonContent>
    </IonPage>
  );
};
