import React, { useEffect, useMemo, useState } from "react";
import { BookOpen, ChevronDown, Clock3, Search, Target } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../context/AuthContext";

const categories = [
  "Alle",
  "Jernslag",
  "Wedges",
  "Putting",
  "Driver",
  "Bunker",
];

export default function ExercisesPage() {
  const { user } = useAuth();
  const [exercises, setExercises] = useState([]);
  const [category, setCategory] = useState("Alle");
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    async function loadExercises() {
      setLoading(true);
      const { data, error: queryError } = await supabase
        .from("exercises")
        .select(
          "id,title,category,description,instructions,duration_minutes,facilities,difficulty,target",
        )
        .order("category")
        .order("title");
      if (!active) return;
      if (queryError)
        setError(`${queryError.message}. Har du kørt SQL-scriptet i Supabase?`);
      setExercises(data || []);
      setLoading(false);
    }
    if (user) loadExercises();
    return () => {
      active = false;
    };
  }, [user]);

  const filtered = useMemo(
    () =>
      exercises.filter((exercise) => {
        const matchesCategory =
          category === "Alle" || exercise.category === category;
        const text =
          `${exercise.title} ${exercise.description} ${exercise.category} ${exercise.target || ""}`.toLocaleLowerCase(
            "da-DK",
          );
        return (
          matchesCategory &&
          text.includes(search.trim().toLocaleLowerCase("da-DK"))
        );
      }),
    [exercises, category, search],
  );

  const categoryCounts = useMemo(
    () =>
      Object.fromEntries(
        categories.map((item) => [
          item,
          item === "Alle"
            ? exercises.length
            : exercises.filter((exercise) => exercise.category === item).length,
        ]),
      ),
    [exercises],
  );

  return (
    <div className="page-enter exercises-page">
      <div className="page-header">
        <div>
          <div className="eyebrow">ØVELSER TIL DIT NÆSTE SKRIDT</div>
          <h1>
            Øvelsesbibliotek<span className="heading-dot">.</span>
          </h1>
          <p className="page-lead">
            Find en øvelse, forstå hvordan du udfører den, og tilføj den til din
            næste træningsplan.
          </p>
        </div>
        <div className="page-header-icon">
          <BookOpen size={25} />
        </div>
      </div>

      <div className="exercise-library-toolbar">
        <div className="exercise-search">
          <Search size={18} />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Søg efter øvelse eller fokus…"
            aria-label="Søg efter øvelse"
          />
        </div>
        <div className="exercise-count">
          <strong>{filtered.length}</strong>{" "}
          {filtered.length === 1 ? "øvelse" : "øvelser"}
        </div>
      </div>

      <div
        className="category-filter"
        role="tablist"
        aria-label="Filtrér øvelser efter kategori"
      >
        {categories.map((item) => (
          <button
            key={item}
            role="tab"
            aria-selected={category === item}
            className={`category-filter-button ${category === item ? "category-filter-active" : ""}`}
            onClick={() => setCategory(item)}
          >
            {item}
            <span>{categoryCounts[item] || 0}</span>
          </button>
        ))}
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {loading ? (
        <div className="empty-state">
          <span className="spinner" /> Henter øvelser…
        </div>
      ) : filtered.length ? (
        <div className="exercise-grid">
          {filtered.map((exercise, index) => {
            const expanded = expandedId === exercise.id;
            const theme =
              {
                Jernslag: "exercise-theme-green",
                Wedges: "exercise-theme-sand",
                Putting: "exercise-theme-blue",
                Driver: "exercise-theme-olive",
                Bunker: "exercise-theme-purple",
              }[exercise.category] || "exercise-theme-green";
            return (
              <article className="exercise-card" key={exercise.id}>
                <div className={`exercise-card-art ${theme}`}>
                  <span className="exercise-card-category">
                    {exercise.category}
                  </span>
                  <div className="exercise-art-orbit orbit-one" />
                  <div className="exercise-art-orbit orbit-two" />
                  <div className="exercise-art-icon">
                    <Target size={28} strokeWidth={1.5} />
                  </div>
                  <span className="exercise-card-number">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                </div>
                <div className="exercise-card-body">
                  <div className="exercise-card-meta">
                    <span>
                      <Clock3 size={14} /> {exercise.duration_minutes} min.
                    </span>
                    <span>{exercise.difficulty || "Alle niveauer"}</span>
                  </div>
                  <h2>{exercise.title}</h2>
                  <p>{exercise.description}</p>
                  {exercise.target && (
                    <div className="exercise-target">
                      <span>MÅL</span>
                      {exercise.target}
                    </div>
                  )}
                  <button
                    className="exercise-details-toggle"
                    onClick={() => setExpandedId(expanded ? null : exercise.id)}
                    aria-expanded={expanded}
                  >
                    {expanded ? "Skjul instruktioner" : "Se instruktioner"}
                    <ChevronDown
                      size={16}
                      className={expanded ? "chevron-up" : ""}
                    />
                  </button>
                  {expanded && (
                    <div className="exercise-instructions">
                      <h3>Sådan gør du</h3>
                      <ol>
                        {(exercise.instructions || []).map(
                          (instruction, instructionIndex) => (
                            <li key={`${exercise.id}-${instructionIndex}`}>
                              {instruction}
                            </li>
                          ),
                        )}
                      </ol>
                      <h3>Hvor kan du træne?</h3>
                      <div className="tag-list">
                        {(exercise.facilities || []).map((facility) => (
                          <span className="tag tag-green" key={facility}>
                            {facility}
                          </span>
                        ))}
                      </div>
                      <p className="exercise-library-note">
                        Tip: Du kan vælge øvelsen i{" "}
                        <strong>Planlæg træning</strong> og tilpasse tiden til
                        din session.
                      </p>
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="empty-state">
          <div className="empty-state-icon">
            <Search size={22} />
          </div>
          <h3>Ingen øvelser fundet</h3>
          <p>Prøv en anden søgning eller vælg en anden kategori.</p>
          <button
            className="button button-outline"
            onClick={() => {
              setSearch("");
              setCategory("Alle");
            }}
          >
            Vis alle øvelser
          </button>
        </div>
      )}
    </div>
  );
}
