import React from "react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertCircle,
  ArrowRight,
  Check,
  ChevronDown,
  Clock3,
  Flag,
  LoaderCircle,
  Play,
  Plus,
  RefreshCw,
  Save,
  Sparkles,
  Target,
  Trash2,
} from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../context/AuthContext";

const CATEGORIES = ["Jernslag", "Wedges", "Putting", "Driver", "Bunker"];
const TIME_OPTIONS = [15, 30, 45, 60, 90];


function allocateMinutes(total, count) {
  if (!count) return [];
  const base = Math.floor(total / count);
  const remainder = total % count;
  return Array.from(
    { length: count },
    (_, index) => base + (index < remainder ? 1 : 0),
  );
}

function prettyCategory(category) {
  return category === "Wedges" ? "Wedges" : category;
}

export default function PlannerPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [minutes, setMinutes] = useState("30");
  const [areas, setAreas] = useState(["Wedges", "Putting"]);
  const [prioritizeLatest, setPrioritizeLatest] = useState(true);
  const [latestReview, setLatestReview] = useState(null);
  const [exercises, setExercises] = useState([]);
  const [loading, setLoading] = useState(true);
  const [plan, setPlan] = useState([]);
  const [extraExerciseId, setExtraExerciseId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let active = true;
    async function loadPlannerData() {
      setLoading(true);
      const [exerciseResult, reviewResult] = await Promise.all([
        supabase
          .from("exercises")
          .select(
            "id,title,category,description,instructions,duration_minutes,facilities,difficulty,target",
          )
          .order("category")
          .order("title"),
        supabase
          .from("round_reviews")
          .select("id,played_at,focus_areas,notes")
          .order("played_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);
      if (!active) return;
      if (exerciseResult.error)
        setError(
          `Kunne ikke hente øvelser: ${exerciseResult.error.message}. Har du kørt SQL-scriptet i Supabase?`,
        );
      if (reviewResult.error)
        setError(
          `Kunne ikke hente din seneste runde: ${reviewResult.error.message}`,
        );
      setExercises(exerciseResult.data || []);
      setLatestReview(reviewResult.data || null);
      setLoading(false);
    }
    if (user) loadPlannerData();
    return () => {
      active = false;
    };
  }, [user]);

  const availableAreas = useMemo(
    () => [...new Set(exercises.map((exercise) => exercise.category))],
    [exercises],
  );
  const effectiveAreas = useMemo(
    () => [
      ...new Set([
        ...areas,
        ...(prioritizeLatest && latestReview
          ? latestReview.focus_areas || []
          : []),
      ]),
    ],
    [areas, prioritizeLatest, latestReview],
  );
  const eligibleExercises = exercises;

  const chosenIds = plan.map((exercise) => exercise.id);
  const extraOptions = eligibleExercises.filter(
    (exercise) =>
      effectiveAreas.includes(exercise.category) &&
      !chosenIds.includes(exercise.id),
  );
  const totalPlannedMinutes = plan.reduce(
    (sum, exercise) => sum + Number(exercise.duration_minutes || 0),
    0,
  );

  function toggleArea(area) {
    setAreas((current) =>
      current.includes(area)
        ? current.filter((item) => item !== area)
        : [...current, area],
    );
    setPlan([]);
    setError("");
    setNotice("");
  }

  function generatePlan() {
    setError("");
    setNotice("");
    setPlan([]);
    const duration = Number(minutes);
    if (!Number.isInteger(duration) || duration < 5 || duration > 240) {
      setError("Vælg en træning på mellem 5 og 240 minutter.");
      return;
    }
    if (!effectiveAreas.length) {
      setError("Vælg mindst ét område, du vil træne.");
      return;
    }
    if (duration < effectiveAreas.length * 5) {
      setError(
        `Du har valgt ${effectiveAreas.length} fokusområder. Vælg mindst ${effectiveAreas.length * 5} minutter, så der er tid til hvert område.`,
      );
      return;
    }

    const groups = effectiveAreas.map((category) => ({
      category,
      items: eligibleExercises.filter(
        (exercise) => exercise.category === category,
      ),
      cursor: 0,
    }));
    const missing = groups
      .filter((group) => group.items.length === 0)
      .map((group) => group.category);
    if (missing.length) {
      setError(
        `Der er ikke fundet øvelser til ${missing.join(", ")}. Prøv at vælge et andet fokusområde.`,
      );
      return;
    }

    const desiredCount = Math.min(
      8,
      Math.max(groups.length, Math.floor(duration / 10)),
    );
    const selected = [];
    // Give every focus area at least one exercise first.
    groups.forEach((group) => {
      selected.push(group.items[group.cursor]);
      group.cursor += 1;
    });
    // Add more varied exercises until the time budget or library suggests stopping.
    let safety = 0;
    while (selected.length < desiredCount && safety < 100) {
      let added = false;
      for (const group of groups) {
        if (selected.length >= desiredCount) break;
        const next = group.items[group.cursor];
        if (next && !selected.some((exercise) => exercise.id === next.id)) {
          selected.push(next);
          group.cursor += 1;
          added = true;
        }
      }
      if (!added) break;
      safety += 1;
    }

    const durations = allocateMinutes(duration, selected.length);
    setPlan(
      selected.map((exercise, index) => ({
        ...exercise,
        duration_minutes: durations[index],
        planned_order: index,
      })),
    );
    setNotice(
      "Din træning er sammensat. Du kan stadig fjerne eller tilføje øvelser, før du gemmer planen.",
    );
  }

  function removeExercise(exerciseId) {
    const next = plan.filter((exercise) => exercise.id !== exerciseId);
    if (!next.length) {
      setPlan([]);
      return;
    }
    const durations = allocateMinutes(Number(minutes), next.length);
    setPlan(
      next.map((exercise, index) => ({
        ...exercise,
        duration_minutes: durations[index],
        planned_order: index,
      })),
    );
    setNotice("");
  }

  function addExercise() {
    const exercise = extraOptions.find((item) => item.id === extraExerciseId);
    if (!exercise) return;
    if (Number(minutes) < (plan.length + 1) * 5) {
      setError(
        "Du skal have mindst 5 minutter pr. øvelse. Vælg mere tid, eller fjern en øvelse.",
      );
      return;
    }
    const next = [...plan, { ...exercise }];
    const durations = allocateMinutes(Number(minutes), next.length);
    setPlan(
      next.map((item, index) => ({
        ...item,
        duration_minutes: durations[index],
        planned_order: index,
      })),
    );
    setExtraExerciseId("");
    setError("");
    setNotice("");
  }

  async function savePlan(startNow = false) {
    setError("");
    if (!plan.length) {
      setError("Sammensæt en træningsplan først.");
      return;
    }
    if (totalPlannedMinutes !== Number(minutes)) {
      setError(
        "Tidsfordelingen passer ikke helt. Klik på “Sammensæt min træning” for at beregne planen igen.",
      );
      return;
    }

    setSaving(true);
    const dateLabel = new Intl.DateTimeFormat("da-DK", {
      day: "numeric",
      month: "short",
    }).format(new Date());
    const { data: session, error: sessionError } = await supabase
      .from("training_sessions")
      .insert({
        user_id: user.id,
        title: `Træning · ${dateLabel}`,
        duration_minutes: Number(minutes),
        focus_areas: effectiveAreas,
        facility: "Alle faciliteter",
        prioritize_recent_round: Boolean(prioritizeLatest && latestReview),
        status: startNow ? "in_progress" : "planned",
      })
      .select()
      .single();

    if (sessionError || !session) {
      setError(sessionError?.message || "Træningen kunne ikke gemmes.");
      setSaving(false);
      return;
    }

    const rows = plan.map((exercise, index) => ({
      session_id: session.id,
      exercise_id: exercise.id,
      exercise_title: exercise.title,
      category: exercise.category,
      description: exercise.description,
      instructions: exercise.instructions || [],
      duration_minutes: Number(exercise.duration_minutes),
      position: index,
      completed: false,
    }));
    const { error: exercisesError } = await supabase
      .from("training_session_exercises")
      .insert(rows);
    if (exercisesError) {
      await supabase.from("training_sessions").delete().eq("id", session.id);
      setError(
        `Planen blev oprettet, men øvelserne kunne ikke gemmes: ${exercisesError.message}`,
      );
      setSaving(false);
      return;
    }
    navigate(startNow ? `/sessions/${session.id}` : "/");
  }

  return (
    <div className="page-enter planner-page">
      <div className="page-header">
        <div>
          <div className="eyebrow">DIN TID · DIT FOKUS</div>
          <h1>
            Planlæg træning<span className="heading-dot">.</span>
          </h1>
          <p className="page-lead">
            Fortæl, hvor lang tid du har, og hvad du vil træne. Så sammensætter
            GolfLoop en plan til dig.
          </p>
        </div>
        <div className="page-header-icon">
          <CalendarDaysIcon />
        </div>
      </div>

      {error && (
        <div className="alert alert-error">
          <AlertCircle size={18} /> <span>{error}</span>
        </div>
      )}
      {loading && (
        <div className="inline-loading">
          <span className="spinner" /> Henter øvelser fra dit bibliotek…
        </div>
      )}

      <div className="planner-layout">
        <div className="planner-controls">
          <section className="form-panel">
            <div className="form-step">
              <span>01</span>
              <div>
                <h2>Hvor lang tid har du?</h2>
                <p>Vælg den tid, du realistisk kan bruge.</p>
              </div>
            </div>
            <div className="time-options">
              {TIME_OPTIONS.map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => {
                    setMinutes(String(value));
                    setPlan([]);
                    setNotice("");
                  }}
                  className={`time-option ${String(value) === minutes ? "time-option-active" : ""}`}
                >
                  <strong>{value}</strong>
                  <span>min.</span>
                </button>
              ))}
              <label
                className={`time-option time-option-custom ${!TIME_OPTIONS.includes(Number(minutes)) ? "time-option-active" : ""}`}
              >
                <input
                  type="number"
                  min="5"
                  max="240"
                  value={!TIME_OPTIONS.includes(Number(minutes)) ? minutes : ""}
                  placeholder="Andet"
                  onChange={(event) => {
                    setMinutes(event.target.value);
                    setPlan([]);
                    setNotice("");
                  }}
                  aria-label="Eget antal minutter"
                />
                <span>min.</span>
              </label>
            </div>
          </section>

          <section className="form-panel">
            <div className="form-step">
              <span>02</span>
              <div>
                <h2>Hvad vil du træne?</h2>
                <p>Vælg flere områder, hvis du ønsker det.</p>
              </div>
            </div>
            <div className="area-grid">
              {CATEGORIES.filter((category) =>
                availableAreas.includes(category),
              ).map((category) => {
                const checked = areas.includes(category);
                const descriptions = {
                  Jernslag: "Kontakt og præcision",
                  Wedges: "Indspil og længdekontrol",
                  Putting: "Afstand og korte putts",
                  Driver: "Retning og længde",
                  Bunker: "Teknik og kontrol",
                };
                return (
                  <button
                    key={category}
                    type="button"
                    className={`area-option ${checked ? "area-option-active" : ""}`}
                    onClick={() => toggleArea(category)}
                    aria-pressed={checked}
                  >
                    <span
                      className={`area-option-mark ${checked ? "" : "area-option-mark-empty"}`}
                    >
                      {checked && <Check size={15} />}
                    </span>
                    <span className="area-option-copy">
                      <strong>{prettyCategory(category)}</strong>
                      <small>{descriptions[category]}</small>
                    </span>
                  </button>
                );
              })}
              {!loading && !availableAreas.length && (
                <p className="muted">
                  Der blev ikke fundet øvelser. Kør SQL-scriptet i Supabase for
                  at indsætte øvelsesbiblioteket.
                </p>
              )}
            </div>
          </section>

          <section
            className={`round-focus-card ${!latestReview ? "round-focus-card-empty" : ""}`}
          >
            <div className="round-focus-icon">
              <Flag size={20} />
            </div>
            <div className="round-focus-content">
              <strong>Brug mit fokus fra seneste runde</strong>
              <p>
                {latestReview
                  ? `Tilføj dine fokusområder fra runden ${new Intl.DateTimeFormat("da-DK", { day: "numeric", month: "short" }).format(new Date(latestReview.played_at))} til træningsplanen.`
                  : "Når du har evalueret en runde, kan vi prioritere dine registrerede udfordringer her."}
              </p>
              {latestReview && (
                <div className="tag-list">
                  {(latestReview.focus_areas || []).map((area) => (
                    <span className="tag tag-green" key={area}>
                      {area}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <label
              className="switch"
              aria-label="Brug fokusområder fra seneste runde"
            >
              <input
                type="checkbox"
                checked={prioritizeLatest}
                disabled={!latestReview}
                onChange={(event) => {
                  setPrioritizeLatest(event.target.checked);
                  setPlan([]);
                  setNotice("");
                }}
              />
              <span className="switch-slider" />
            </label>
          </section>

          <button
            className="button button-primary button-large generate-button"
            type="button"
            disabled={loading}
            onClick={generatePlan}
          >
            <Sparkles size={18} /> Sammensæt min træning{" "}
            <ArrowRight size={18} />
          </button>
        </div>

        <aside className="plan-preview-panel">
          <div className="plan-preview-top">
            <div className="eyebrow">DIN TRÆNINGSPLAN</div>
            <div className="plan-preview-icon">
              <Target size={21} />
            </div>
            <h2>{plan.length ? "Klar til træning" : "Din næste træning"}</h2>
            <p>
              {plan.length
                ? "Justér øvelserne, og gem planen, når den passer dig."
                : "Dine valgte øvelser vises her, når du har sammensat planen."}
            </p>
          </div>
          <div className="plan-total">
            <div>
              <span>Samlet tid</span>
              <strong>
                {plan.length
                  ? totalPlannedMinutes
                  : Number(minutes) > 0
                    ? Number(minutes)
                    : 0}{" "}
                <small>min.</small>
              </strong>
            </div>
            <div className="plan-total-time">
              <Clock3 size={17} />
              <span>
                {plan.length} {plan.length === 1 ? "øvelse" : "øvelser"}
              </span>
            </div>
          </div>

          {plan.length ? (
            <div className="planned-exercises">
              {plan.map((exercise, index) => (
                <div
                  className="planned-exercise"
                  key={`${exercise.id}-${index}`}
                >
                  <div className="planned-exercise-index">
                    {String(index + 1).padStart(2, "0")}
                  </div>
                  <div className="planned-exercise-copy">
                    <span className="planned-category">
                      {exercise.category}
                    </span>
                    <strong>{exercise.title}</strong>
                    <small>
                      {exercise.duration_minutes} min. ·{" "}
                      {exercise.target || "Se øvelsesbeskrivelsen"}
                    </small>
                  </div>
                  <button
                    className="icon-button danger-icon"
                    aria-label={`Fjern ${exercise.title}`}
                    onClick={() => removeExercise(exercise.id)}
                    title="Fjern øvelse"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
              {extraOptions.length > 0 && (
                <div className="add-exercise-row">
                  <select
                    value={extraExerciseId}
                    onChange={(event) => setExtraExerciseId(event.target.value)}
                    aria-label="Vælg ekstra øvelse"
                  >
                    <option value="">Tilføj en øvelse…</option>
                    {extraOptions.map((exercise) => (
                      <option key={exercise.id} value={exercise.id}>
                        {exercise.category} · {exercise.title}
                      </option>
                    ))}
                  </select>
                  <button
                    className="icon-button add-exercise-button"
                    onClick={addExercise}
                    disabled={!extraExerciseId}
                    aria-label="Tilføj øvelse"
                  >
                    <Plus size={18} />
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="plan-empty-state">
              <div className="plan-empty-illustration">
                <Target size={35} strokeWidth={1.3} />
              </div>
              <strong>Din træning, på din måde</strong>
              <p>
                Vælg tid og fokus til venstre. Vi fordeler minutterne mellem
                konkrete øvelser.
              </p>
            </div>
          )}

          {notice && (
            <div className="alert alert-success plan-notice">
              <Check size={16} />
              <span>{notice}</span>
            </div>
          )}
          <div className="plan-preview-footer">
            <p>
              <Flag size={15} />
              Vælg, om du vil træne nu eller gemme planen til senere.
            </p>

            <button
              className="button button-primary button-large panel-full-button"
              disabled={!plan.length || saving}
              onClick={() => savePlan(true)}
            >
              {saving ? (
                <>
                  <LoaderCircle size={18} className="spin" />
                  Gemmer…
                </>
              ) : (
                <>
                  <Play size={17} />
                  Start træningen nu
                  <ArrowRight size={17} />
                </>
              )}
            </button>

            <button
              className="button button-outline panel-full-button"
              disabled={!plan.length || saving}
              onClick={() => savePlan(false)}
            >
              {saving ? (
                <LoaderCircle size={17} className="spin" />
              ) : (
                <Save size={17} />
              )}
              Gem til senere
            </button>

            <button
              className="button button-ghost panel-full-button"
              onClick={() => {
                setPlan([]);
                setNotice("");
                setError("");
              }}
              disabled={!plan.length || saving}
            >
              <RefreshCw size={16} />
              Nulstil plan
            </button>
          </div>
        </aside>
      </div>
      <div className="planner-footnote">
        <span className="footnote-mark">i</span>
        <p>
          Planen fordeler den samlede tid på de valgte øvelser. Brug den som en
          fleksibel guide, og tilpas længde og antal bolde efter dit niveau.
        </p>
      </div>
    </div>
  );
}

function CalendarDaysIcon() {
  return <Clock3 size={24} />;
}
