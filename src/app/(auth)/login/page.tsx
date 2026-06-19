'use client'
import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff, Mail, Lock, ArrowLeft, Check } from 'lucide-react'
import { authClient } from '@/lib/auth-client'

/* ── Helpers ── */
function calcStrength(pwd: string) {
  const checks = {
    length:  pwd.length >= 6,
    upper:   /[A-Z]/.test(pwd),
    number:  /[0-9]/.test(pwd),
    special: /[!@#$%^&*]/.test(pwd),
  }
  return { checks, score: Object.values(checks).filter(Boolean).length }
}

const STRENGTH_LABELS = ['', 'Fraca', 'Regular', 'Boa', 'Forte']
const STRENGTH_COLORS = ['', '#ef4444', '#f59e0b', '#3b82f6', '#22c55e']

/* ── Sub-components ── */
function Logo({ center = false }: { center?: boolean }) {
  return (
    <div style={{ textAlign: center ? 'center' : 'left' }}>
      <p style={{ fontFamily: 'var(--font-geist-sans)', fontSize: 22, fontWeight: 800, color: '#09090b', letterSpacing: '-0.05em', lineHeight: 1 }}>
        SplitTest
      </p>
      <p style={{ fontSize: 11, fontWeight: 500, color: '#a1a1aa', letterSpacing: '0.03em', marginTop: 3 }}>
        Plataforma de Testes A/B
      </p>
    </div>
  )
}

function Card({ children, animDir = 'right' }: { children: React.ReactNode; animDir?: 'right' | 'left' | 'up' }) {
  const anims = {
    right: 'translateX(-12px)',
    left:  'translateX(12px)',
    up:    'translateY(14px)',
  }
  return (
    <div
      style={{
        background: '#fff',
        borderRadius: 18,
        padding: '36px 40px',
        width: '100%',
        maxWidth: 440,
        boxShadow: '0 24px 80px rgba(0,0,0,0.35)',
        animation: 'authCardIn 0.35s cubic-bezier(0.16,1,0.3,1) both',
      }}
    >
      <style>{`
        @keyframes authCardIn {
          from { opacity: 0; transform: ${anims[animDir]}; }
          to   { opacity: 1; transform: none; }
        }
      `}</style>
      {children}
    </div>
  )
}

function AuthInput({
  label, type = 'text', value, onChange, onKeyDown, icon: Icon, placeholder, autoFocus, error, rightSlot,
}: {
  label: string
  type?: string
  value: string
  onChange: (v: string) => void
  onKeyDown?: (e: React.KeyboardEvent) => void
  icon?: React.ComponentType<{ size?: number; style?: React.CSSProperties }>
  placeholder?: string
  autoFocus?: boolean
  error?: string
  rightSlot?: React.ReactNode
}) {
  const [focused, setFocused] = useState(false)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={{ fontSize: 12, fontWeight: 600, color: '#3f3f46', letterSpacing: '0.01em' }}>
        {label}
      </label>
      <div style={{ position: 'relative' }}>
        <input
          type={type}
          value={value}
          onChange={e => onChange(e.target.value)}
          onKeyDown={onKeyDown}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={placeholder}
          autoFocus={autoFocus}
          style={{
            width: '100%',
            height: 40,
            border: `1.5px solid ${error ? '#ef4444' : focused ? '#18181b' : '#e4e4e7'}`,
            borderRadius: 8,
            padding: rightSlot || Icon ? '0 44px 0 14px' : '0 14px',
            fontFamily: 'var(--font-geist-sans)',
            fontSize: 14,
            color: '#09090b',
            background: focused ? '#fafafa' : '#fff',
            boxShadow: focused ? '0 0 0 3px rgba(24,24,27,0.07)' : error ? '0 0 0 3px rgba(239,68,68,0.08)' : 'none',
            outline: 'none',
            transition: 'all 0.15s',
          }}
        />
        {Icon && !rightSlot && (
          <Icon size={16} style={{ position: 'absolute', right: 13, top: '50%', transform: 'translateY(-50%)', color: focused ? '#18181b' : '#d4d4d8', transition: 'color 0.15s', pointerEvents: 'none' }} />
        )}
        {rightSlot}
      </div>
      {error && <p style={{ fontSize: 12, color: '#ef4444', margin: 0 }}>{error}</p>}
    </div>
  )
}

function AuthBtn({ children, onClick, loading, type = 'button', disabled }: {
  children: React.ReactNode
  onClick?: () => void
  loading?: boolean
  type?: 'button' | 'submit'
  disabled?: boolean
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      style={{
        width: '100%',
        height: 42,
        background: disabled || loading ? '#d4d4d8' : '#18181b',
        color: disabled || loading ? '#a1a1aa' : '#fff',
        border: 'none',
        borderRadius: 8,
        fontFamily: 'var(--font-geist-sans)',
        fontSize: 14,
        fontWeight: 600,
        cursor: disabled || loading ? 'not-allowed' : 'pointer',
        transition: 'background 0.15s',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {loading
        ? <span style={{ width: 18, height: 18, border: '2.5px solid rgba(255,255,255,0.35)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
        : children}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </button>
  )
}

function BackLink({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, fontWeight: 500, color: '#71717a', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
      onMouseEnter={e => (e.currentTarget.style.color = '#09090b')}
      onMouseLeave={e => (e.currentTarget.style.color = '#71717a')}
    >
      <ArrowLeft size={14} /> Voltar
    </button>
  )
}

/* ── Steps ── */
function StepEmail({ onNext }: { onNext: (email: string) => void }) {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')

  function handleNext() {
    if (!email.trim()) { setError('Informe seu e-mail'); return }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setError('E-mail inválido'); return }
    onNext(email.trim())
  }

  return (
    <Card animDir="right">
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <Logo center />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <AuthInput
          label="E-MAIL"
          type="email"
          value={email}
          onChange={v => { setEmail(v); setError('') }}
          onKeyDown={e => e.key === 'Enter' && handleNext()}
          icon={Mail}
          placeholder="seu@email.com"
          autoFocus
          error={error}
        />
        <AuthBtn onClick={handleNext} disabled={!email.trim()}>
          Próximo
        </AuthBtn>
      </div>
    </Card>
  )
}

function StepPassword({ email, onBack, onForgot }: { email: string; onBack: () => void; onForgot: () => void }) {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleLogin() {
    if (!password) { setError('Informe sua senha'); return }
    setLoading(true); setError('')
    const { error: err } = await authClient.signIn.email({ email, password })
    if (err) {
      setError('E-mail ou senha inválidos')
      setLoading(false)
    } else {
      router.push('/org')
    }
  }

  const name = email.split('@')[0]
  const displayName = name.charAt(0).toUpperCase() + name.slice(1)

  return (
    <Card animDir="right">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
        <BackLink onClick={onBack} />
        <Logo />
      </div>
      <h2 style={{ fontFamily: 'var(--font-geist-sans)', fontSize: 20, fontWeight: 700, color: '#09090b', marginBottom: 24, letterSpacing: '-0.3px' }}>
        Olá, {displayName}! 👋
      </h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <AuthInput
            label="SENHA"
            type={showPass ? 'text' : 'password'}
            value={password}
            onChange={v => { setPassword(v); setError('') }}
            onKeyDown={e => e.key === 'Enter' && handleLogin()}
            autoFocus
            error={error}
            rightSlot={
              <button
                type="button"
                onClick={() => setShowPass(v => !v)}
                style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#d4d4d8', display: 'flex', padding: 2 }}
                onMouseEnter={e => (e.currentTarget.style.color = '#18181b')}
                onMouseLeave={e => (e.currentTarget.style.color = '#d4d4d8')}
              >
                {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            }
          />
          <button
            onClick={onForgot}
            style={{ fontSize: 12, fontWeight: 500, color: '#71717a', background: 'none', border: 'none', cursor: 'pointer', marginTop: 8, padding: 0 }}
            onMouseEnter={e => (e.currentTarget.style.color = '#09090b')}
            onMouseLeave={e => (e.currentTarget.style.color = '#71717a')}
          >
            Esqueceu sua senha?
          </button>
        </div>
        <AuthBtn onClick={handleLogin} loading={loading} disabled={!password}>
          Entrar
        </AuthBtn>
      </div>
    </Card>
  )
}

function StepForgot({ email: initialEmail, onBack, onSent }: { email: string; onBack: () => void; onSent: (email: string) => void }) {
  const [email, setEmail] = useState(initialEmail)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSend() {
    if (!email.trim()) { setError('Informe seu e-mail'); return }
    setLoading(true); setError('')
    await authClient.requestPasswordReset({
      email: email.trim(),
      redirectTo: `${window.location.origin}/login`,
    })
    setLoading(false)
    onSent(email.trim())
  }

  return (
    <Card animDir="left">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
        <BackLink onClick={onBack} />
        <Logo />
      </div>
      <h2 style={{ fontFamily: 'var(--font-geist-sans)', fontSize: 18, fontWeight: 700, color: '#09090b', marginBottom: 6, letterSpacing: '-0.3px' }}>
        Recuperar senha
      </h2>
      <p style={{ fontSize: 13, color: '#71717a', marginBottom: 24, lineHeight: 1.5 }}>
        Enviaremos um link de redefinição para seu e-mail.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <AuthInput
          label="E-MAIL"
          type="email"
          value={email}
          onChange={v => { setEmail(v); setError('') }}
          onKeyDown={e => e.key === 'Enter' && handleSend()}
          icon={Mail}
          placeholder="seu@email.com"
          autoFocus
          error={error}
        />
        <AuthBtn onClick={handleSend} loading={loading} disabled={!email.trim()}>
          Enviar link
        </AuthBtn>
      </div>
    </Card>
  )
}

function StepLinkSent({ email, onBack }: { email: string; onBack: () => void }) {
  return (
    <Card animDir="up">
      <div style={{ textAlign: 'center', padding: '12px 0 4px' }}>
        <div style={{ width: 56, height: 56, background: '#18181b', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
          <Mail size={22} color="#fff" />
        </div>
        <h2 style={{ fontFamily: 'var(--font-geist-sans)', fontSize: 20, fontWeight: 700, color: '#09090b', marginBottom: 8, letterSpacing: '-0.3px' }}>
          Link enviado!
        </h2>
        <p style={{ fontSize: 13, color: '#71717a', marginBottom: 28, lineHeight: 1.6 }}>
          Verifique sua caixa de entrada em<br />
          <strong style={{ color: '#09090b' }}>{email}</strong>
        </p>
        <button
          onClick={onBack}
          style={{ fontSize: 13, fontWeight: 500, color: '#71717a', background: 'none', border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5 }}
          onMouseEnter={e => (e.currentTarget.style.color = '#09090b')}
          onMouseLeave={e => (e.currentTarget.style.color = '#71717a')}
        >
          <ArrowLeft size={14} /> Voltar ao login
        </button>
      </div>
    </Card>
  )
}

/* ── Page ── */
type Step = 'email' | 'password' | 'forgot' | 'link-sent'

export default function LoginPage() {
  const [step, setStep] = useState<Step>('email')
  const [email, setEmail] = useState('')

  return (
    <>
      {step === 'email' && (
        <StepEmail
          onNext={e => { setEmail(e); setStep('password') }}
        />
      )}
      {step === 'password' && (
        <StepPassword
          email={email}
          onBack={() => setStep('email')}
          onForgot={() => setStep('forgot')}
        />
      )}
      {step === 'forgot' && (
        <StepForgot
          email={email}
          onBack={() => setStep('password')}
          onSent={e => { setEmail(e); setStep('link-sent') }}
        />
      )}
      {step === 'link-sent' && (
        <StepLinkSent
          email={email}
          onBack={() => setStep('email')}
        />
      )}
    </>
  )
}
