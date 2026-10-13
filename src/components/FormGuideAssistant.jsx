import { useEffect, useMemo, useRef, useState } from "react";
import "./FormGuideAssistant.css";

const TAB_GUIDANCE = {
  "daily-report": "I’ll help you complete the daily progress report one field at a time.",
  "wpr-generator": "I can guide you through the weekly report options and generation steps.",
  "site-report": "I’ll guide you through the site report one field at a time.",
};

const GENERIC_TIPS = [
  [/site|project|location/i, "Choose the site or project where this work or request belongs."],
  [/date|day|month|period/i, "Choose the date or reporting period this entry covers."],
  [/name|person|employee|engineer|vendor|contractor/i, "Enter the full name so this record can be identified later."],
  [/email/i, "Enter a valid email address for the person associated with this record."],
  [/phone|mobile|contact/i, "Enter a reachable phone number, including the country code if needed."],
  [/quantity|qty|count|number|workers|manpower/i, "Enter the actual count or quantity, and double-check the unit."],
  [/amount|cost|rate|budget/i, "Enter the amount as a number and verify the currency or unit."],
  [/photo|image|file|attachment|upload|document/i, "Attach a clear, relevant photo or document that supports this entry."],
  [/reason|remark|note|comment|concern|issue/i, "Be specific: describe what happened, where, and any follow-up needed."],
  [/description|detail|work|progress|activity|task/i, "Describe the work clearly, including the location, current status, and measurable progress."],
  [/type|category|status|trade/i, "Choose the option that best matches this entry."],
  [/time/i, "Enter the time this event actually happened."],
  [/address/i, "Enter the complete location, including any block, floor, or unit details."],
];

function fieldName(element) {
  const labelled = Array.from(element.labels || [])
    .map((label) => label.textContent)
    .filter(Boolean)
    .join(" ");
  const wrapper = element.closest(
    "label, .fg, .field, .form-group, .svr-field, .wpr-fg, .wpr-xl-hdr-field",
  );
  const wrapperLabel = wrapper?.querySelector(
    ".svr-label, .flabel, .form-label, .wpr-lbl, label",
  )?.textContent;
  const raw = [
    element.getAttribute("aria-label"),
    labelled,
    wrapperLabel,
    element.getAttribute("placeholder"),
    element.getAttribute("title"),
    element.getAttribute("name"),
    element.id,
  ].find((value) => value?.trim());
  if (!raw) {
    const section = element.closest(".wpr-acc, .sec-block, .svr-section");
    const sectionName = section?.querySelector(
      ".wpr-acc-title, .sec-title, .sec-collapser > span, .svr-sec-title",
    )?.textContent;
    const controls = section
      ? Array.from(section.querySelectorAll("input, select, textarea")).filter(
          (control) => control.getClientRects().length > 0,
        )
      : [];
    const position = controls.indexOf(element);
    return sectionName
      ? `${sectionName.trim()} field ${Math.max(position + 1, 1)}`
      : `${element.tagName.toLowerCase()} field`;
  }
  const cleaned = raw
    .replace(/\s+/g, " ")
    .replace(/\*/g, "")
    .replace(/(optional|required)/gi, "")
    .trim();
  if (cleaned) return cleaned.slice(0, 72);
  const section = element.closest(".wpr-acc, .sec-block, .svr-section");
  const sectionName = section?.querySelector(
    ".wpr-acc-title, .sec-title, .sec-collapser > span, .svr-sec-title",
  )?.textContent;
  return sectionName ? `${sectionName.trim()} field` : `${element.tagName.toLowerCase()} field`;
}

function getFields(root) {
  if (!root) return [];
  const seenRadioGroups = new Set();
  return Array.from(root.querySelectorAll("input, select, textarea"))
    .filter((element) => {
      const type = (element.getAttribute("type") || "").toLowerCase();
      return (
        !element.disabled &&
        !element.readOnly &&
        !["hidden", "button", "submit", "reset"].includes(type) &&
        element.getClientRects().length > 0
      );
    })
    .filter((element) => {
      const type = (element.getAttribute("type") || "").toLowerCase();
      if (type === "radio") {
        if (!element.name || seenRadioGroups.has(element.name)) return false;
        seenRadioGroups.add(element.name);
      }
      return true;
    })
    .map((element) => ({ element, name: fieldName(element) }));
}

function isFilled(field, root) {
  const element = field.element || field;
  if (element.type === "file") return Boolean(element.files?.length);
  if (element.type === "checkbox") return element.checked;
  if (element.type === "radio" && element.name) {
    return Boolean(root?.querySelector(`input[type="radio"][name="${CSS.escape(element.name)}"]:checked`));
  }
  return Boolean(String(element.value || "").trim());
}

function fieldTip(name, activeTab) {
  const normalized = name.toLowerCase();
  if (activeTab === "apply-leave") {
    if (/leave type/.test(normalized)) return "Choose the leave category that matches your request.";
    if (/from date/.test(normalized)) return "Select the first day you will be away.";
    if (/to date/.test(normalized)) return "Select the last day you will be away. Check the total days before submitting.";
    if (/reason/.test(normalized)) return "Briefly explain why you need leave. Include useful context for your approver.";
  }
  if (activeTab === "site-report") {
    if (/quality|observation|finding|snag|non.conformance/.test(normalized)) return "Record the specific observation, its location, and any corrective action needed.";
    if (/safety/.test(normalized)) return "Describe the safety concern and the action required to address it.";
    if (/visit date|inspection date/.test(normalized)) return "Choose the date the site visit or inspection took place.";
  }
  if (activeTab === "daily-report") {
    if (/morning|evening|report type/.test(normalized)) return "Choose Morning Plan for planned work or Evening Progress for completed work.";
    if (/manpower|worker|labou?r/.test(normalized)) return "Enter the actual workforce count for the relevant trade or contractor.";
    if (/photo|image/.test(normalized)) return "Add clear site photos that support the progress described in this report.";
  }
  if (activeTab === "material-arrived") {
    if (/quantity|qty/.test(normalized)) return "Enter the quantity physically received and verify its unit.";
    if (/challan|invoice|photo|file/.test(normalized)) return "Attach a readable delivery challan or invoice for this receipt.";
  }
  if (activeTab === "weekly-plan") {
    if (/activity|work|plan|target/.test(normalized)) return "Describe the work planned for the selected week, with a clear location or measurable target.";
  }
  if (activeTab === "wpr-generator") {
    if (/start|from/.test(normalized)) return "Choose the first day of the reporting week.";
    if (/end|to/.test(normalized)) return "Choose the last day of the reporting week and confirm the range.";
  }
  return GENERIC_TIPS.find(([pattern]) => pattern.test(name))?.[1]
    || `Enter or choose the information for “${name}”. I’ll move on when this field has a value.`;
}

export default function FormGuideAssistant({ activeTab }) {
  const [open, setOpen] = useState(false);
  const [fields, setFields] = useState([]);
  const [index, setIndex] = useState(0);
  const [position, setPosition] = useState(null);
  const currentFieldRef = useRef(null);
  const assistantRef = useRef(null);
  const fieldListRef = useRef([]);
  const indexRef = useRef(0);
  const dragRef = useRef(null);
  const suppressClickRef = useRef(false);
  const userPositionedRef = useRef(false);

  const intro = TAB_GUIDANCE[activeTab];
  const isSupportedTab = Boolean(intro);
  const current = fields[index] || null;
  const tip = useMemo(
    () => (current ? fieldTip(current.name, activeTab) : intro),
    [activeTab, current, intro],
  );

  useEffect(() => {
    if (!TAB_GUIDANCE[activeTab]) {
      userPositionedRef.current = false;
      setPosition(null);
      setOpen(false);
    }
  }, [activeTab]);

  useEffect(() => {
    setFields([]);
    fieldListRef.current = [];
    setIndex(0);
    indexRef.current = 0;
    const root = document.querySelector("[data-form-guide-root]");
    if (!root || !intro) return undefined;
    let timer;
    const refresh = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        const nextFields = getFields(root);
        const activeElement = fieldListRef.current[indexRef.current]?.element;
        fieldListRef.current = nextFields;
        setFields(nextFields);
        const preservedIndex = activeElement
          ? nextFields.findIndex((field) => field.element === activeElement)
          : -1;
        if (preservedIndex >= 0) {
          indexRef.current = preservedIndex;
          setIndex(preservedIndex);
        } else {
          const currentIndex = Math.min(indexRef.current, nextFields.length);
          const active = nextFields[currentIndex];
          if (active && !isFilled(active, root)) return;
          const nextIndex = nextFields.findIndex(
            (field, fieldIndex) => fieldIndex >= currentIndex && !isFilled(field, root),
          );
          const selectedIndex = nextIndex >= 0 ? nextIndex : nextFields.length;
          indexRef.current = selectedIndex;
          setIndex(selectedIndex);
        }
      }, 120);
    };
    const onFieldChange = (event) => {
      const target = event.target;
      const currentFields = getFields(root);
      fieldListRef.current = currentFields;
      const currentIndex = currentFields.findIndex((field) =>
        field.element === target ||
        (target.type === "radio" && field.element.name === target.name),
      );
      setFields(currentFields);
      if (
        event.type === "change" &&
        currentIndex === indexRef.current &&
        isFilled(currentFields[currentIndex], root)
      ) {
        const nextIndex = currentFields.findIndex(
          (field, fieldIndex) => fieldIndex > currentIndex && !isFilled(field, root),
        );
        const selectedIndex = nextIndex >= 0 ? nextIndex : currentFields.length;
        indexRef.current = selectedIndex;
        setIndex(selectedIndex);
      }
      refresh();
    };
    const onFieldFocus = (event) => {
      const currentFields = getFields(root);
      fieldListRef.current = currentFields;
      const selectedIndex = currentFields.findIndex((field) =>
        field.element === event.target ||
        (event.target.type === "radio" && field.element.name === event.target.name),
      );
      if (selectedIndex < 0) return;
      setFields(currentFields);
      indexRef.current = selectedIndex;
      setIndex(selectedIndex);
    };
    const onFieldBlur = (event) => {
      const currentFields = getFields(root);
      const currentIndex = currentFields.findIndex((field) =>
        field.element === event.target ||
        (event.target.type === "radio" && field.element.name === event.target.name),
      );
      if (currentIndex !== indexRef.current || !isFilled(currentFields[currentIndex], root)) return;
      const nextIndex = currentFields.findIndex(
        (field, fieldIndex) => fieldIndex > currentIndex && !isFilled(field, root),
      );
      const selectedIndex = nextIndex >= 0 ? nextIndex : currentFields.length;
      fieldListRef.current = currentFields;
      setFields(currentFields);
      indexRef.current = selectedIndex;
      setIndex(selectedIndex);
    };
    const onSectionOpen = (event) => {
      const section = event.detail?.section;
      if (!section) return;
      setOpen(true);
      const selectSectionField = (attempt = 0) => {
        const currentFields = getFields(root);
        const sectionFields = currentFields.filter((field) => section.contains(field.element));
        if (!sectionFields.length) {
          if (attempt < 5) window.setTimeout(() => selectSectionField(attempt + 1), 100);
          return;
        }
        const target = sectionFields.find((field) => !isFilled(field, root)) || sectionFields[0];
        const selectedIndex = currentFields.findIndex((field) => field.element === target.element);
        fieldListRef.current = currentFields;
        setFields(currentFields);
        indexRef.current = selectedIndex;
        setIndex(selectedIndex);
      };
      window.setTimeout(() => selectSectionField(), 80);
    };
    const observer = new MutationObserver(refresh);
    observer.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ["disabled", "hidden", "style", "class"] });
    root.addEventListener("input", onFieldChange, true);
    root.addEventListener("change", onFieldChange, true);
    root.addEventListener("focusin", onFieldFocus, true);
    root.addEventListener("focusout", onFieldBlur, true);
    window.addEventListener("form-guide-section-open", onSectionOpen);
    refresh();
    return () => {
      window.clearTimeout(timer);
      observer.disconnect();
      root.removeEventListener("input", onFieldChange, true);
      root.removeEventListener("change", onFieldChange, true);
      root.removeEventListener("focusin", onFieldFocus, true);
      root.removeEventListener("focusout", onFieldBlur, true);
      window.removeEventListener("form-guide-section-open", onSectionOpen);
    };
  }, [activeTab, intro]);

  useEffect(() => {
    if (!current?.element) return undefined;
    const element = current.element;
    element.classList.add("form-guide-current-field");
    currentFieldRef.current = element;
    return () => {
      element.classList.remove("form-guide-current-field");
      if (currentFieldRef.current === element) currentFieldRef.current = null;
    };
  }, [current]);

  useEffect(() => {
    if (!open || userPositionedRef.current) return undefined;
    const placeAssistant = () => {
      const viewportWidth = window.visualViewport?.width || window.innerWidth;
      const viewportHeight = window.visualViewport?.height || window.innerHeight;
      const box = assistantRef.current?.getBoundingClientRect();
      const assistantWidth = box?.width || Math.min(270, viewportWidth - 20);
      const assistantHeight = box?.height || 98;
      const rect = current?.element?.getBoundingClientRect();
      let left = rect ? rect.left : viewportWidth - assistantWidth - 76;
      left = Math.max(10, Math.min(left, viewportWidth - assistantWidth - 10));
      let top = rect ? rect.top - assistantHeight - 10 : viewportHeight - assistantHeight - 112;
      if (top < 10 && rect) top = rect.bottom + 10;
      top = Math.max(10, Math.min(top, viewportHeight - assistantHeight - 10));
      setPosition({ left, top });
    };
    placeAssistant();
    window.addEventListener("resize", placeAssistant);
    window.addEventListener("scroll", placeAssistant, true);
    window.visualViewport?.addEventListener("resize", placeAssistant);
    window.visualViewport?.addEventListener("scroll", placeAssistant);
    const observer = current?.element && typeof ResizeObserver !== "undefined"
      ? new ResizeObserver(placeAssistant)
      : null;
    if (current?.element) observer?.observe(current.element);
    return () => {
      window.removeEventListener("resize", placeAssistant);
      window.removeEventListener("scroll", placeAssistant, true);
      window.visualViewport?.removeEventListener("resize", placeAssistant);
      window.visualViewport?.removeEventListener("scroll", placeAssistant);
      observer?.disconnect();
    };
  }, [current, open]);

  const startDrag = (event) => {
    if (!open || event.button !== 0) return;
    const rect = assistantRef.current?.getBoundingClientRect();
    if (!rect) return;
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      left: rect.left,
      top: rect.top,
      moved: false,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const moveDrag = (event) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const deltaX = event.clientX - drag.startX;
    const deltaY = event.clientY - drag.startY;
    if (Math.abs(deltaX) + Math.abs(deltaY) > 4) {
      drag.moved = true;
      userPositionedRef.current = true;
    }
    if (!drag.moved) return;
    const rect = assistantRef.current?.getBoundingClientRect();
    const width = rect?.width || 270;
    const height = rect?.height || 98;
    const viewportWidth = window.visualViewport?.width || window.innerWidth;
    const viewportHeight = window.visualViewport?.height || window.innerHeight;
    setPosition({
      left: Math.max(6, Math.min(drag.left + deltaX, viewportWidth - width - 6)),
      top: Math.max(6, Math.min(drag.top + deltaY, viewportHeight - height - 6)),
    });
  };

  const endDrag = (event) => {
    if (!dragRef.current || dragRef.current.pointerId !== event.pointerId) return;
    suppressClickRef.current = dragRef.current.moved;
    dragRef.current = null;
  };

  const toggleGuide = () => {
    if (open) return;
    const viewportWidth = window.visualViewport?.width || window.innerWidth;
    const viewportHeight = window.visualViewport?.height || window.innerHeight;
    const materialButton = document.querySelector(".pf-fab-material");
    const materialRect = materialButton?.getBoundingClientRect();
    const initialLeft = materialRect
      ? materialRect.right - 270
      : viewportWidth - 294;
    const initialTop = materialRect
      ? materialRect.top - 58
      : viewportHeight - 198;
    setPosition({
      left: Math.max(10, Math.min(initialLeft, viewportWidth - 280)),
      top: Math.max(10, Math.min(initialTop, viewportHeight - 58)),
    });
    userPositionedRef.current = false;
    setOpen(true);
  };

  if (!isSupportedTab) return null;

  return (
    <div
      ref={assistantRef}
      className={`form-guide-assistant${open ? " is-guiding" : ""}`}
      style={open && position ? { left: `${position.left}px`, top: `${position.top}px` } : undefined}
    >
      {open && (
        <div className="form-guide-speech" aria-live="polite">
          <button
            type="button"
            className="form-guide-pause"
            aria-label="Pause form guidance"
            title="Pause guidance"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={() => setOpen(false)}
          >
            ×
          </button>
          <strong>{current ? current.name : "Form Guide"}</strong>
          <span>{current ? tip : intro}</span>
          {current && fields.length > 1 && (
            <small>Step {index + 1} of {fields.length}</small>
          )}
        </div>
      )}
      <button
        type="button"
        className={`form-guide-character${open ? " is-active" : ""}`}
        aria-expanded={open}
        aria-label={open ? "Drag form guide or pause it" : "Start interactive form guide"}
        title={open ? "Drag to move the guide. Click to pause." : "Start form guide"}
        onPointerDown={startDrag}
        onPointerMove={moveDrag}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onClick={() => {
          if (suppressClickRef.current) {
            suppressClickRef.current = false;
            return;
          }
          toggleGuide();
        }}
      >
        <span className="form-guide-bot" aria-hidden="true">
          <span className="form-guide-bot-head"><i /><i /><b /></span>
          <span className="form-guide-bot-body"><i /><i /></span>
        </span>
      </button>
    </div>
  );
}
