import React from "react";
import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { ArrowRight, Eye, EyeOff, Flag, LoaderCircle, LockKeyhole, Mail } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../context/AuthContext";

export default function LoginPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  if (authLoading) return <div className="full-screen-loading"><span className="spinner" /> Henter…</div>;
  if (user) return <Navigate to="/" replace />;

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setMessage("");
    if (!supabase) {
      setError("Supabase er ikke konfigureret. Opret .env.local med din Supabase URL og publishable key.");
      return;
    }
    if (password.length < 6) {
      setError("Adgangskoden skal være mindst 6 tegn.");
      return;
    }

    setSubmitting(true);
    try {
      if (mode === "login") {
        const { error: loginError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (loginError) throw loginError;
        navigate("/", { replace: true });
      } else {
        const { data, error: signupError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (signupError) throw signupError;
        if (data.session) {
          navigate("/", { replace: true });
        } else {
          setMessage("Din konto er oprettet. Tjek din e-mail for at bekræfte din konto, og log derefter ind.");
          setMode("login");
        }
      }
    } catch (submitError) {
      setError(submitError.message || "Der opstod en fejl. Prøv igen.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-page">
      <section className="auth-story">
        <div className="auth-brand"><span className="brand-mark"><Flag size={22} /></span><span>GolfLoop<span className="brand-dot">.</span></span></div>
        <div className="auth-story-content">
          <span className="eyebrow eyebrow-light">SPIL MED ET FORMÅL</span>
          <h1>Hver træning<br /><em>bringer dig videre.</em></h1>
          <p>Få styr på dit fokus, planlæg dine træninger og se de små fremskridt blive til bedre golf.</p>
          <div className="auth-story-stats">
            <div><strong>01</strong><span>Find dit fokus</span></div>
            <div><strong>02</strong><span>Træn målrettet</span></div>
            <div><strong>03</strong><span>Følg din udvikling</span></div>
          </div>
        </div>
        <div className="auth-footnote">EN PERSONLIG TRÆNINGSDAGBOG FOR GOLFSPILLERE</div>
      </section>

      <section className="auth-form-side">
        <div className="auth-form-card">
          <span className="eyebrow">VELKOMMEN TIL GOLFLOOP</span>
          <h2>{mode === "login" ? "Godt at se dig igen" : "Kom godt i gang"}</h2>
          <p className="auth-subtitle">{mode === "login" ? "Log ind og fortsæt din udvikling." : "Opret en konto, og begynd at træne med et formål."}</p>

          <div className="auth-tabs" role="tablist" aria-label="Log ind eller opret konto">
            <button className={mode === "login" ? "auth-tab auth-tab-active" : "auth-tab"} onClick={() => { setMode("login"); setError(""); setMessage(""); }} type="button">Log ind</button>
            <button className={mode === "signup" ? "auth-tab auth-tab-active" : "auth-tab"} onClick={() => { setMode("signup"); setError(""); setMessage(""); }} type="button">Opret konto</button>
          </div>

          <form onSubmit={handleSubmit} className="auth-form">
            <label className="field-label" htmlFor="email">E-mail</label>
            <div className="input-with-icon"><Mail size={18} /><input id="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="dig@eksempel.dk" autoComplete="email" required /></div>

            <label className="field-label" htmlFor="password">Adgangskode</label>
            <div className="input-with-icon"><LockKeyhole size={18} /><input id="password" type={showPassword ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Mindst 6 tegn" autoComplete={mode === "login" ? "current-password" : "new-password"} required minLength={6} /><button className="password-toggle" type="button" onClick={() => setShowPassword((current) => !current)} aria-label={showPassword ? "Skjul adgangskode" : "Vis adgangskode"}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></div>

            {error && <div className="alert alert-error" role="alert">{error}</div>}
            {message && <div className="alert alert-success" role="status">{message}</div>}

            <button className="button button-primary auth-submit" type="submit" disabled={submitting}>
              {submitting ? <LoaderCircle className="spin" size={18} /> : <>{mode === "login" ? "Log ind" : "Opret konto"}<ArrowRight size={18} /></>}
            </button>
          </form>
          <p className="auth-privacy">Din træning og dine noter gemmes privat på din konto.</p>
        </div>
      </section>
    </div>
  );
}
