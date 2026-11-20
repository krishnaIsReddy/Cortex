// The sidebar's repo switcher: a button showing the open repo that opens a
// searchable list of analyzed repos and sample datasets, with links to
// analyze or manage repos at the bottom.
//
// Keyboard: the search box is a combobox. Up/Down (and Home/End) move
// through the list, Enter opens the highlighted repo, Escape closes and
// returns focus to the button.
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Link } from "react-router";
import Icon from "./Icon.jsx";
import { formatRelative } from "../dashboard/format.js";
import { sampleRepoOptions } from "../../services/mockData/index.js";
import { REPOSITORIES_PATH } from "../../routes.js";

// "tartley/colorama" -> { owner: "tartley", name: "colorama" }
function splitName(fullName) {
  const slash = fullName.indexOf("/");
  return slash === -1
    ? { owner: null, name: fullName }
    : { owner: fullName.slice(0, slash), name: fullName.slice(slash + 1) };
}

export default function RepoSwitcher({ value, onChange, liveRepos, liveLoading, liveError }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const rootRef = useRef(null);
  const buttonRef = useRef(null);
  const inputRef = useRef(null);
  const listId = useId();

  // Every repo as one shape, analyzed repos first.
  const allOptions = useMemo(
    () => [
      ...liveRepos.map((repo) => ({
        id: repo.id,
        group: "Analyzed",
        ...splitName(repo.name),
        detail: repo.analyzedAt ? `Analyzed ${formatRelative(repo.analyzedAt)}` : "Not analyzed yet",
      })),
      ...sampleRepoOptions.map((sample) => ({
        id: sample.id,
        group: "Sample data",
        owner: null,
        name: sample.label,
        detail: "Sample data",
      })),
    ],
    [liveRepos]
  );

  const normalized = query.trim().toLowerCase();
  const options = normalized
    ? allOptions.filter((option) =>
        `${option.owner ?? ""}/${option.name}`.toLowerCase().includes(normalized)
      )
    : allOptions;

  const current = allOptions.find((option) => option.id === value);

  // Close when clicking anywhere outside the switcher.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  // Keep the highlighted option scrolled into view.
  useEffect(() => {
    if (!open) return;
    document.getElementById(`${listId}-${activeIndex}`)?.scrollIntoView({ block: "nearest" });
  }, [open, activeIndex, listId]);

  const openMenu = () => {
    setQuery("");
    // Start on the open repo, so Enter right away is a no-op.
    const currentIndex = allOptions.findIndex((option) => option.id === value);
    setActiveIndex(Math.max(0, currentIndex));
    setOpen(true);
  };

  const close = ({ returnFocus = true } = {}) => {
    setOpen(false);
    if (returnFocus) buttonRef.current?.focus();
  };

  const choose = (option) => {
    close();
    if (option.id !== value) onChange(option.id);
  };

  const onKeyDown = (event) => {
    const last = options.length - 1;
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        setActiveIndex((index) => (index >= last ? 0 : index + 1));
        break;
      case "ArrowUp":
        event.preventDefault();
        setActiveIndex((index) => (index <= 0 ? last : index - 1));
        break;
      case "Home":
        event.preventDefault();
        setActiveIndex(0);
        break;
      case "End":
        event.preventDefault();
        setActiveIndex(last);
        break;
      case "Enter":
        event.preventDefault();
        if (options[activeIndex]) choose(options[activeIndex]);
        break;
      case "Escape":
        event.preventDefault();
        close();
        break;
      case "Tab":
        close({ returnFocus: false });
        break;
      default:
    }
  };

  // Why the Analyzed group is empty, when it is.
  let liveStatus = null;
  if (liveLoading) liveStatus = "Loading…";
  else if (liveError) liveStatus = "Can't reach the Cortex API";
  else if (liveRepos.length === 0) liveStatus = "None analyzed yet";

  return (
    <div className="repo-switcher" ref={rootRef}>
      <button
        ref={buttonRef}
        type="button"
        className="repo-switcher__button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => (open ? close() : openMenu())}
      >
        <span className="repo-switcher__current">
          {current ? (
            <>
              <span className="repo-switcher__owner">{current.owner ?? current.group}</span>
              <span className="repo-switcher__name">{current.name}</span>
            </>
          ) : (
            <>
              <span className="repo-switcher__owner">Repository</span>
              <span className="repo-switcher__name repo-switcher__name--placeholder">Choose a repository</span>
            </>
          )}
        </span>
        <Icon name="chevronUpDown" className="repo-switcher__chevron" />
        <span className="visually-hidden">, switch repository</span>
      </button>

      {open && (
        <div className="repo-switcher__menu">
          <div className="repo-switcher__search">
            <Icon name="search" />
            <input
              ref={inputRef}
              // Focused as soon as the menu opens, so typing filters right away.
              autoFocus
              type="text"
              role="combobox"
              aria-expanded="true"
              aria-controls={listId}
              aria-activedescendant={options[activeIndex] ? `${listId}-${activeIndex}` : undefined}
              aria-autocomplete="list"
              aria-label="Find a repository"
              placeholder="Find a repository…"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setActiveIndex(0);
              }}
              onKeyDown={onKeyDown}
            />
          </div>

          <ul id={listId} role="listbox" aria-label="Repositories" className="repo-switcher__list">
            {options.length === 0 && (
              <li className="repo-switcher__empty" role="presentation">
                No repositories match “{query.trim()}”.
              </li>
            )}
            {options.map((option, index) => {
              const startsGroup = index === 0 || options[index - 1].group !== option.group;
              const selected = option.id === value;
              return (
                <OptionRow
                  key={option.id}
                  id={`${listId}-${index}`}
                  option={option}
                  heading={startsGroup ? option.group : null}
                  // Only shown above the first sample when no live repo is listed.
                  status={startsGroup && option.group === "Sample data" && !normalized ? liveStatus : null}
                  active={index === activeIndex}
                  selected={selected}
                  onHover={() => setActiveIndex(index)}
                  onChoose={() => choose(option)}
                />
              );
            })}
          </ul>

          <div className="repo-switcher__footer">
            <Link to={REPOSITORIES_PATH} className="repo-switcher__action" onClick={() => close({ returnFocus: false })}>
              <Icon name="plus" size={14} />
              Analyze a repository
            </Link>
            <Link to={REPOSITORIES_PATH} className="repo-switcher__action" onClick={() => close({ returnFocus: false })}>
              Manage
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

// One repo in the list, with its group heading above it when it's the first
// of its group. The heading is presentation only; the group shows in the
// option's own text for screen readers.
function OptionRow({ id, option, heading, status, active, selected, onHover, onChoose }) {
  return (
    <>
      {status && (
        <li role="presentation" className="repo-switcher__group">
          Analyzed
          <span className="repo-switcher__status">{status}</span>
        </li>
      )}
      {heading && (
        <li role="presentation" className="repo-switcher__group">
          {heading}
        </li>
      )}
      <li
        id={id}
        role="option"
        aria-selected={selected}
        className={`repo-switcher__option${active ? " is-active" : ""}${selected ? " is-selected" : ""}`}
        onMouseMove={onHover}
        // mousedown, not click, so the search box doesn't lose focus first.
        onMouseDown={(event) => {
          event.preventDefault();
          onChoose();
        }}
      >
        <span className="repo-switcher__option-text">
          <span className="repo-switcher__option-name">
            {option.owner && <span className="repo-switcher__option-owner">{option.owner}/</span>}
            {option.name}
          </span>
          <span className="repo-switcher__option-detail">{option.detail}</span>
        </span>
        {selected && <Icon name="check" className="repo-switcher__check" />}
      </li>
    </>
  );
}
