import React from "react";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  Clock3,
  Flag,
  LoaderCircle,
  Save,
  Target,
} from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../context/AuthContext";

export default function SessionDetailPage() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [session, setSession] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let active = true;
    async function loadSession() {
      setLoading(true);
      const { data, error: queryError } = await supabase
        .from("training_sessions")
        .select(
          "id,title,duration_minutes,focus_areas,facility,status,created_at,completed_at,prioritize_recent_round,training_session_exercises(id,exercise_id,exercise_title,category,description,instructions,duration_minutes,position,completed,result_notes)",
        )
        .eq("id", sessionId)
        .single();
      if (!active) return;
      if (queryError)
        setError(`Træningen kunne ikke hentes: ${queryError.message}`);
      if (data) {
        setSession(data);
        setItems(
          [...(data.training_session_exercises || [])].sort(
            (a, b) => a.position - b.position,
          ),
        );
      }
      setLoading(false);
    }
    if (user && sessionId) loadSession();
    return () => {
      active = false;
    };
  }, [user, sessionId]);

  function updateItem(itemId, field, value) {
    setItems((current) =>
      current.map((item) =>
        item.id === itemId ? { ...item, [field]: value } : item,
      ),
    );
    setNotice("");
  }

  async function saveExerciseNotes() {
    setSaving(true);
    setError("");
    for (const item of items) {
      const { error: updateError } = await supabase
        .from("training_session_exercises")
        .update({
          completed: item.completed,
          result_notes: item.result_notes || null,
        })
        .eq("id", item.id);
      if (updateError) {
        setError(`Kunne ikke gemme øvelsesnoter: ${updateError.message}`);
        setSaving(false);
        return false;
      }
    }
    setNotice("Dine resultater er gemt.");
    setSaving(false);
    return true;
  }

  async function startTraining() {
    if (!session || session.status !== "planned") return;
    setSaving(true);
    const { error: updateError } = await supabase
      .from("training_sessions")
      .update({ status: "in_progress" })
      .eq("id", session.id);
    if (updateError) setError(updateError.message);
    else setSession((current) => ({ ...current, status: "in_progress" }));
    setSaving(false);
  }

  async function completeTraining() {
    const allSaved = await saveExerciseNotes();
    if (!allSaved) return;
    setSaving(true);
    const { data, error: updateError } = await supabase
      .from("training_sessions")
      .update({ status: "completed", completed_at: new Date().toISOString() })
      .eq("id", session.id)
      .select()
      .single();
    if (updateError) {
      setError(
        `Øvelserne blev gemt, men træningen kunne ikke afsluttes: ${updateError.message}`,
      );
      setSaving(false);
      return;
    }
    setSession((current) => ({ ...current, ...data }));
    setNotice("Flot arbejde! Træningen er markeret som gennemført.");
    setSaving(false);
  }

  const completedCount = items.filter((item) => item.completed).length;
  const isCompleted = session?.status === "completed";

  if (loading)
    return (
      <div className="empty-state page-loader">
        <span className="spinner" /> Henter din træning…
      </div>
    );
  if (!session)
    return (
      <div className="empty-state">
        <h2>Træningen blev ikke fundet</h2>
        <p>Den kan være slettet, eller du har ikke adgang til den.</p>
        <Link to="/" className="button button-primary">
          Tilbage til overblik
        </Link>
      </div>
    );

  return (
    <div className="page-enter session-detail-page">
      <Link to="/" className="back-link">
        <ArrowLeft size={16} /> Tilbage til overblik
      </Link>
      <div className="session-detail-hero">
        <div className="session-detail-hero-copy">
          <div className="eyebrow">DIN TRÆNINGSPLAN</div>
          <h1>
            {session.title || "Min træning"}
            <span className="heading-dot">.</span>
          </h1>
          <p className="page-lead">
            Følg øvelserne, registrér dine resultater, og gem det, du lærer.
          </p>
          <div className="session-summary-tags">
            <span>
              <Clock3 size={15} /> {session.duration_minutes} minutter
            </span>
            <span>
              <Target size={15} /> {items.length} øvelser
            </span>
            <span>
              <Flag size={15} /> {session.facility}
            </span>
          </div>
        </div>
        <div className={`status-pill status-${session.status}`}>
          {session.status === "completed"
            ? "Gennemført"
            : session.status === "in_progress"
              ? "I gang"
              : "Planlagt"}
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {notice && (
        <div className="alert alert-success">
          <CheckCircle2 size={18} /> {notice}
        </div>
      )}

      <div className="session-progress-panel">
        <div className="progress-panel-copy">
          <strong>Din fremgang</strong>
          <span>
            {completedCount} af {items.length} øvelser markeret som gennemført
          </span>
        </div>
        <div className="progress-track">
          <div
            className="progress-fill"
            style={{
              width: `${items.length ? (completedCount / items.length) * 100 : 0}%`,
            }}
          />
        </div>
      </div>

      <div className="session-exercises-list">
        {items.map((item, index) => (
          <article
            className={`session-exercise-card ${item.completed ? "session-exercise-done" : ""}`}
            key={item.id}
          >
            <div className="session-exercise-header">
              <div className="session-exercise-number">
                {String(index + 1).padStart(2, "0")}
              </div>
              <div className="session-exercise-title">
                <span className="planned-category">
                  {item.category} · {item.duration_minutes} min.
                </span>
                <h2>{item.exercise_title}</h2>
                <p>{item.description}</p>
              </div>
              <label className="completed-checkbox">
                <input
                  type="checkbox"
                  checked={Boolean(item.completed)}
                  onChange={(event) =>
                    updateItem(item.id, "completed", event.target.checked)
                  }
                  disabled={isCompleted}
                />
                <span>
                  <Check size={15} />
                </span>
                <small>{item.completed ? "Gennemført" : "Færdig"}</small>
              </label>
            </div>
            {item.instructions?.length > 0 && (
              <details className="session-instructions">
                <summary>Vis øvelsen trin for trin</summary>
                <ol>
                  {item.instructions.map((step, stepIndex) => (
                    <li key={`${item.id}-${stepIndex}`}>{step}</li>
                  ))}
                </ol>
              </details>
            )}
            <label className="field-label" htmlFor={`result-${item.id}`}>
              Dine resultater / noter
            </label>
            <textarea
              id={`result-${item.id}`}
              className="plain-textarea result-textarea"
              rows={2}
              value={item.result_notes || ""}
              onChange={(event) =>
                updateItem(item.id, "result_notes", event.target.value)
              }
              placeholder="Fx 7 ud af 10 putts i hul fra én meter…"
              disabled={isCompleted}
            />
          </article>
        ))}
      </div>

      <div className="session-actions">
        {session.status === "planned" && (
          <button
            className="button button-outline"
            onClick={startTraining}
            disabled={saving}
          >
            <Flag size={17} /> Start træningen
          </button>
        )}
        {!isCompleted && (
          <button
            className="button button-outline"
            onClick={saveExerciseNotes}
            disabled={saving}
          >
            <Save size={17} /> Gem resultater
          </button>
        )}
        {!isCompleted && (
          <button
            className="button button-primary"
            onClick={completeTraining}
            disabled={saving || items.length === 0}
          >
            {saving ? (
              <LoaderCircle size={17} className="spin" />
            ) : (
              <CheckCircle2 size={18} />
            )}{" "}
            Markér træning som gennemført
          </button>
        )}
        {isCompleted && (
          <div className="completed-message">
            <CheckCircle2 size={19} /> Træning gennemført — godt arbejde!
          </div>
        )}
      </div>
      {isCompleted && (
        <div className="next-step-card">
          <div>
            <strong>Klar til næste skridt?</strong>
            <p>
              Din næste træning kan tage udgangspunkt i, hvad du lærte i dag.
            </p>
          </div>
          <button
            className="button button-primary"
            onClick={() => navigate("/planner")}
          >
            Planlæg næste træning{" "}
            <ArrowLeft className="arrow-right-icon" size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
