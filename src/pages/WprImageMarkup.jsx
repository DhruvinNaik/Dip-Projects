import { useEffect, useRef, useState } from "react";

const COLORS = ["#dc2626", "#16a34a", "#2563eb", "#c96a10", "#111827"];
const TOOLS = [
  { id: "rect", label: "Square" },
  { id: "circle", label: "Circle" },
  { id: "line", label: "Draw" },
  { id: "text", label: "Text" },
];

function withAlpha(hex, alpha) {
  const raw = hex.replace("#", "");
  const r = parseInt(raw.slice(0, 2), 16);
  const g = parseInt(raw.slice(2, 4), 16);
  const b = parseInt(raw.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function textBoxOf(ctx, mark) {
  const size = mark.size || 24;
  ctx.save();
  ctx.font = `700 ${size}px "Segoe UI", sans-serif`;
  const width = ctx.measureText(mark.text || "").width;
  ctx.restore();
  const padX = size * 0.42;
  const padY = size * 0.3;
  return {
    x: mark.x,
    y: mark.y,
    w: Math.max(width + padX * 2, size),
    h: size + padY * 2,
    padX,
    padY,
    size,
  };
}

function drawMark(ctx, mark, selected) {
  ctx.save();
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.strokeStyle = mark.color;
  ctx.fillStyle = withAlpha(mark.color, 0.34);
  ctx.lineWidth = mark.width || 4;
  if (mark.type === "rect") {
    ctx.fillRect(mark.x, mark.y, mark.w, mark.h);
    ctx.strokeRect(mark.x, mark.y, mark.w, mark.h);
  } else if (mark.type === "ellipse") {
    const rx = Math.abs(mark.w) / 2;
    const ry = Math.abs(mark.h) / 2;
    if (rx > 1 && ry > 1) {
      ctx.beginPath();
      ctx.ellipse(mark.x + mark.w / 2, mark.y + mark.h / 2, rx, ry, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  } else if (mark.type === "line" && mark.points?.length) {
    ctx.beginPath();
    mark.points.forEach((point, index) => {
      if (index === 0) ctx.moveTo(point.x, point.y);
      else ctx.lineTo(point.x, point.y);
    });
    ctx.stroke();
  } else if (mark.type === "text" && mark.text) {
    const box = textBoxOf(ctx, mark);
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(box.x, box.y, box.w, box.h, 8);
    else ctx.rect(box.x, box.y, box.w, box.h);
    ctx.fill();
    ctx.lineWidth = Math.max(2, box.size / 14);
    ctx.stroke();
    ctx.font = `700 ${box.size}px "Segoe UI", sans-serif`;
    ctx.fillStyle = mark.color;
    ctx.fillText(mark.text, box.x + box.padX, box.y + box.padY + box.size * 0.82);
    if (selected) {
      ctx.setLineDash([8, 6]);
      ctx.strokeStyle = "#111827";
      ctx.lineWidth = 2;
      ctx.strokeRect(box.x - 4, box.y - 4, box.w + 8, box.h + 8);
    }
  }
  ctx.restore();
}

function boxFrom(start, end) {
  return {
    x: Math.min(start.x, end.x),
    y: Math.min(start.y, end.y),
    w: Math.abs(end.x - start.x),
    h: Math.abs(end.y - start.y),
  };
}

export default function WprImageMarkup({ imageUrl, onCancel, onSave }) {
  const canvasRef = useRef(null);
  const stageRef = useRef(null);
  const imgRef = useRef(null);
  const startRef = useRef(null);
  const draftRef = useRef(null);
  const toolRef = useRef("rect");
  const colorRef = useRef(COLORS[0]);
  const marksRef = useRef([]);
  const pointersRef = useRef(new Map());
  const pinchRef = useRef(null);
  const suppressDrawRef = useRef(false);
  const zoomRef = useRef(1);
  const [ready, setReady] = useState(false);
  const [tool, setTool] = useState("rect");
  const [color, setColor] = useState(COLORS[0]);
  const [marks, setMarks] = useState([]);
  const [draft, setDraft] = useState(null);
  const [textBox, setTextBox] = useState(null);
  const [selectedText, setSelectedText] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [viewTick, setViewTick] = useState(0);
  const [error, setError] = useState("");
  const dragRef = useRef(null);
  zoomRef.current = zoom;

  toolRef.current = tool;
  colorRef.current = color;
  marksRef.current = marks;

  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      setReady(true);
    };
    img.onerror = () => setError("Could not open this image.");
    img.src = imageUrl;
  }, [imageUrl]);

  useEffect(() => {
    const img = imgRef.current;
    const canvas = canvasRef.current;
    if (!ready || !img || !canvas) return;
    const stage = stageRef.current;
    const maxW = Math.max(160, (stage?.clientWidth || window.innerWidth - 32) - 8);
    const maxH = Math.min(620, Math.max(220, window.innerHeight * 0.5));
    const fit = Math.min(maxW / img.width, maxH / img.height, 1);
    const scale = fit * zoom;
    canvas.width = img.width;
    canvas.height = img.height;
    canvas.style.width = `${Math.max(1, Math.round(img.width * scale))}px`;
    canvas.style.height = `${Math.max(1, Math.round(img.height * scale))}px`;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0);
    [...marks, draft].filter(Boolean).forEach((mark, index) => drawMark(ctx, mark, index === selectedText));
  }, [ready, marks, draft, selectedText, zoom]);

  useEffect(() => {
    const stage = stageRef.current;
    const bump = () => setViewTick((tick) => tick + 1);
    stage?.addEventListener("scroll", bump, { passive: true });
    window.addEventListener("resize", bump);
    return () => {
      stage?.removeEventListener("scroll", bump);
      window.removeEventListener("resize", bump);
    };
  }, [ready]);

  const changeZoom = (next, clientX, clientY) => {
    const stage = stageRef.current;
    const prev = zoomRef.current || 1;
    const clamped = Math.min(4, Math.max(0.5, next));
    if (!stage) {
      zoomRef.current = clamped;
      setZoom(clamped);
      return;
    }
    const stageRect = stage.getBoundingClientRect();
    const px = clientX == null ? stageRect.left + stage.clientWidth / 2 : clientX;
    const py = clientY == null ? stageRect.top + stage.clientHeight / 2 : clientY;
    const ratio = clamped / prev;
    const ox = px - stageRect.left + stage.scrollLeft;
    const oy = py - stageRect.top + stage.scrollTop;
    zoomRef.current = clamped;
    setZoom(clamped);
    requestAnimationFrame(() => {
      stage.scrollLeft = ox * ratio - (px - stageRect.left);
      stage.scrollTop = oy * ratio - (py - stageRect.top);
    });
  };

  useEffect(() => {
    const stage = stageRef.current;
    if (!ready || !stage) return undefined;

    const fingerPoint = (touch) => ({ x: touch.clientX, y: touch.clientY });
    const beginPinch = (touches) => {
      const a = fingerPoint(touches[0]);
      const b = fingerPoint(touches[1]);
      pinchRef.current = {
        dist: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)),
        zoom: zoomRef.current || 1,
        midX: (a.x + b.x) / 2,
        midY: (a.y + b.y) / 2,
        scrollLeft: stage.scrollLeft,
        scrollTop: stage.scrollTop,
      };
      startRef.current = null;
      draftRef.current = null;
      dragRef.current = null;
      suppressDrawRef.current = true;
      setDraft(null);
    };
    const movePinch = (touches) => {
      const pinch = pinchRef.current;
      if (!pinch) return;
      const a = fingerPoint(touches[0]);
      const b = fingerPoint(touches[1]);
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const midX = (a.x + b.x) / 2;
      const midY = (a.y + b.y) / 2;
      const next = Math.min(4, Math.max(0.5, pinch.zoom * (dist / pinch.dist)));
      const ratio = next / (pinch.zoom || 1);
      const stageRect = stage.getBoundingClientRect();
      const ox = pinch.midX - stageRect.left + pinch.scrollLeft;
      const oy = pinch.midY - stageRect.top + pinch.scrollTop;
      zoomRef.current = next;
      setZoom(next);
      stage.scrollLeft = ox * ratio - (midX - stageRect.left);
      stage.scrollTop = oy * ratio - (midY - stageRect.top);
    };
    const onTouchStart = (event) => {
      if (event.touches.length < 2) return;
      event.preventDefault();
      beginPinch(event.touches);
    };
    const onTouchMove = (event) => {
      if (event.touches.length < 2) return;
      event.preventDefault();
      if (!pinchRef.current) beginPinch(event.touches);
      movePinch(event.touches);
    };
    const onTouchEnd = (event) => {
      if (event.touches.length >= 2) {
        beginPinch(event.touches);
        return;
      }
      if (pinchRef.current) {
        pinchRef.current = null;
        startRef.current = null;
        draftRef.current = null;
        dragRef.current = null;
        setDraft(null);
      }
    };
    const onWheel = (event) => {
      event.preventDefault();
      const prev = zoomRef.current || 1;
      const step = event.deltaY > 0 ? -0.12 : 0.12;
      const stageRect = stage.getBoundingClientRect();
      const px = event.clientX;
      const py = event.clientY;
      const next = Math.min(4, Math.max(0.5, prev + step));
      const ratio = next / prev;
      const ox = px - stageRect.left + stage.scrollLeft;
      const oy = py - stageRect.top + stage.scrollTop;
      zoomRef.current = next;
      setZoom(next);
      stage.scrollLeft = ox * ratio - (px - stageRect.left);
      stage.scrollTop = oy * ratio - (py - stageRect.top);
    };

    stage.addEventListener("touchstart", onTouchStart, { passive: false });
    stage.addEventListener("touchmove", onTouchMove, { passive: false });
    stage.addEventListener("touchend", onTouchEnd);
    stage.addEventListener("touchcancel", onTouchEnd);
    stage.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      stage.removeEventListener("touchstart", onTouchStart);
      stage.removeEventListener("touchmove", onTouchMove);
      stage.removeEventListener("touchend", onTouchEnd);
      stage.removeEventListener("touchcancel", onTouchEnd);
      stage.removeEventListener("wheel", onWheel);
    };
  }, [ready]);

  const strokeWidth = () => Math.max(4, (imgRef.current?.width || 800) * 0.004);
  const textSize = () => Math.max(22, Math.round((imgRef.current?.width || 800) * 0.028));

  const clampTextInside = (mark) => {
    const canvas = canvasRef.current;
    if (!canvas || mark?.type !== "text") return mark;
    const ctx = canvas.getContext("2d");
    let next = { ...mark, size: mark.size || textSize() };
    for (let pass = 0; pass < 8; pass += 1) {
      const box = textBoxOf(ctx, next);
      if (box.w <= canvas.width - 8 && box.h <= canvas.height - 8) break;
      next = { ...next, size: Math.max(14, Math.round(next.size * 0.86)) };
    }
    const box = textBoxOf(ctx, next);
    next.x = Math.min(Math.max(4, next.x), Math.max(4, canvas.width - box.w - 4));
    next.y = Math.min(Math.max(4, next.y), Math.max(4, canvas.height - box.h - 4));
    return next;
  };

  const pointFrom = (event) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * canvas.width,
      y: ((event.clientY - rect.top) / rect.height) * canvas.height,
    };
  };

  const hitText = (point) => {
    const canvas = canvasRef.current;
    if (!canvas) return -1;
    const ctx = canvas.getContext("2d");
    for (let index = marksRef.current.length - 1; index >= 0; index -= 1) {
      const mark = marksRef.current[index];
      if (mark.type !== "text") continue;
      const box = textBoxOf(ctx, mark);
      if (point.x >= box.x && point.x <= box.x + box.w && point.y >= box.y && point.y <= box.y + box.h) return index;
    }
    return -1;
  };

  const onPointerDown = (event) => {
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pinchRef.current || pointersRef.current.size >= 2) {
      startRef.current = null;
      draftRef.current = null;
      dragRef.current = null;
      setDraft(null);
      return;
    }
    if (!ready || textBox) return;
    const point = pointFrom(event);
    const hit = hitText(point);
    if (hit >= 0) {
      const mark = marksRef.current[hit];
      dragRef.current = { index: hit, dx: point.x - mark.x, dy: point.y - mark.y };
      setSelectedText(hit);
      event.currentTarget.setPointerCapture(event.pointerId);
      return;
    }
    setSelectedText(null);
    if (toolRef.current === "text") {
      const point = pointFrom(event);
      const rect = canvasRef.current.getBoundingClientRect();
      setTextBox({
        ...point,
        left: rect.left + (point.x / canvasRef.current.width) * rect.width,
        top: rect.top + (point.y / canvasRef.current.height) * rect.height,
        value: "",
      });
      return;
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    startRef.current = point;
    const width = strokeWidth();
    const next = toolRef.current === "line"
      ? { type: "line", points: [point], color: colorRef.current, width }
      : {
          type: toolRef.current === "circle" ? "ellipse" : "rect",
          x: point.x,
          y: point.y,
          w: 0,
          h: 0,
          color: colorRef.current,
          width,
        };
    draftRef.current = next;
    setDraft(next);
  };

  const onPointerMove = (event) => {
    if (pointersRef.current.has(event.pointerId)) {
      pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    }
    if (pinchRef.current || pointersRef.current.size >= 2) return;
    if (dragRef.current) {
      const point = pointFrom(event);
      const { index, dx, dy } = dragRef.current;
      setMarks((prev) => prev.map((mark, item) => {
        if (item !== index) return mark;
        return clampTextInside({ ...mark, x: point.x - dx, y: point.y - dy });
      }));
      return;
    }
    if (!startRef.current || toolRef.current === "text") return;
    const point = pointFrom(event);
    if (toolRef.current === "line") {
      const next = draftRef.current
        ? { ...draftRef.current, points: [...draftRef.current.points, point] }
        : null;
      draftRef.current = next;
      setDraft(next);
      return;
    }
    const box = boxFrom(startRef.current, point);
    const next = draftRef.current ? { ...draftRef.current, ...box } : null;
    draftRef.current = next;
    setDraft(next);
  };

  const onPointerUp = (event) => {
    pointersRef.current.delete(event.pointerId);
    if (pinchRef.current || suppressDrawRef.current) {
      dragRef.current = null;
      startRef.current = null;
      draftRef.current = null;
      setDraft(null);
      if (pointersRef.current.size === 0) suppressDrawRef.current = false;
      return;
    }
    if (dragRef.current) {
      dragRef.current = null;
      return;
    }
    const current = draftRef.current;
    startRef.current = null;
    draftRef.current = null;
    setDraft(null);
    if (!current) return;
    const bigEnough = current.type === "line"
      ? (current.points || []).length > 2
      : current.w > 6 && current.h > 6;
    if (bigEnough) setMarks((prev) => [...prev, current]);
  };

  const commitText = () => {
    const value = textBox?.value?.trim();
    if (value) {
      if (textBox.editIndex != null) {
        setMarks((prev) => prev.map((mark, index) => (
          index === textBox.editIndex ? clampTextInside({ ...mark, text: value }) : mark
        )));
        setSelectedText(textBox.editIndex);
      } else {
        setSelectedText(marksRef.current.length);
        setMarks((prev) => [
          ...prev,
          clampTextInside({
            type: "text",
            x: textBox.x,
            y: textBox.y,
            text: value,
            color: colorRef.current,
            size: textSize(),
          }),
        ]);
      }
    }
    setTextBox(null);
  };

  const resizeText = (delta) => {
    if (selectedText == null) return;
    setMarks((prev) => prev.map((mark, index) => {
      if (index !== selectedText || mark.type !== "text") return mark;
      return clampTextInside({ ...mark, size: Math.min(140, Math.max(16, (mark.size || textSize()) + delta)) });
    }));
  };

  const editSelectedText = () => {
    if (selectedText == null) return;
    const mark = marksRef.current[selectedText];
    const canvas = canvasRef.current;
    if (!mark || mark.type !== "text" || !canvas) return;
    const rect = canvas.getBoundingClientRect();
    setTextBox({
      x: mark.x,
      y: mark.y,
      left: rect.left + (mark.x / canvas.width) * rect.width,
      top: rect.top + (mark.y / canvas.height) * rect.height,
      value: mark.text,
      editIndex: selectedText,
    });
  };

  const save = () => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img) return;
    const pending = textBox?.value?.trim();
    let list = marks;
    if (pending && textBox.editIndex != null) {
      list = marks.map((mark, index) => (index === textBox.editIndex ? clampTextInside({ ...mark, text: pending }) : mark));
    } else if (pending) {
      list = [...marks, clampTextInside({ type: "text", x: textBox.x, y: textBox.y, text: pending, color, size: textSize() })];
    }
    list = list.map((mark) => (mark.type === "text" ? clampTextInside(mark) : mark));
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0);
    [...list, draft].filter(Boolean).forEach((mark) => drawMark(ctx, mark, false));
    onSave(canvas.toDataURL("image/jpeg", 0.92));
  };

  return (
    <div className="wpr-mark-overlay" role="presentation">
      <div className="wpr-mark-modal" role="dialog" aria-modal="true" aria-label="Mark graphical image">
        <header className="wpr-mark-head">
          <div>
            <strong>Mark work sections</strong>
            <p>Pinch or drag with two fingers to zoom. On a computer, use the mouse wheel. Marks stay with the image.</p>
          </div>
          <button type="button" className="wpr-mark-x" onClick={onCancel} aria-label="Close">×</button>
        </header>
        <div className="wpr-mark-tools">
          {TOOLS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`wpr-mark-tool${tool === item.id ? " is-on" : ""}`}
              onClick={() => { setTool(item.id); setTextBox(null); }}
            >
              {item.label}
            </button>
          ))}
          <span className="wpr-mark-colors">
            {COLORS.map((item) => (
              <button
                key={item}
                type="button"
                className={`wpr-mark-swatch${color === item ? " is-on" : ""}`}
                style={{ background: item }}
                aria-label={item}
                onClick={() => setColor(item)}
              />
            ))}
          </span>
          <button type="button" className="wpr-mark-tool" onClick={() => changeZoom(Math.round((zoom - 0.25) * 100) / 100)}>Zoom out</button>
          <button type="button" className="wpr-mark-tool" onClick={() => changeZoom(1)}>{Math.round(zoom * 100)}%</button>
          <button type="button" className="wpr-mark-tool" onClick={() => changeZoom(Math.round((zoom + 0.25) * 100) / 100)}>Zoom in</button>
          <button type="button" className="wpr-mark-tool" onClick={() => resizeText(-4)} disabled={selectedText == null}>Smaller</button>
          <button type="button" className="wpr-mark-tool" onClick={() => resizeText(4)} disabled={selectedText == null}>Larger</button>
          <button type="button" className="wpr-mark-tool" onClick={editSelectedText} disabled={selectedText == null}>Edit text</button>
          <button type="button" className="wpr-mark-tool" onClick={() => { setMarks((prev) => prev.slice(0, -1)); setSelectedText(null); }} disabled={!marks.length}>Undo</button>
          <button type="button" className="wpr-mark-tool" onClick={() => { setMarks([]); setDraft(null); }} disabled={!marks.length}>Clear</button>
        </div>
        <div className="wpr-mark-stage" ref={stageRef}>
          {error ? <p className="wpr-mark-error">{error}</p> : <canvas
            ref={canvasRef}
            className={`wpr-mark-canvas is-${tool}`}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onDoubleClick={(event) => {
              const index = hitText(pointFrom(event));
              if (index < 0) return;
              setSelectedText(index);
              const mark = marksRef.current[index];
              const rect = canvasRef.current.getBoundingClientRect();
              const canvas = canvasRef.current;
              setTextBox({
                x: mark.x,
                y: mark.y,
                left: rect.left + (mark.x / canvas.width) * rect.width,
                top: rect.top + (mark.y / canvas.height) * rect.height,
                value: mark.text,
                editIndex: index,
              });
            }}
          />}
        </div>
        {textBox && (
          <form
            className="wpr-mark-text"
            style={(() => {
              const canvas = canvasRef.current;
              const formW = Math.min(280, window.innerWidth - 16);
              void viewTick;
              const formH = 46;
              if (!canvas) return { left: 8, top: 8, width: formW };
              const rect = canvas.getBoundingClientRect();
              const rawLeft = rect.left + (textBox.x / canvas.width) * rect.width;
              const rawTop = rect.top + (textBox.y / canvas.height) * rect.height;
              return {
                left: Math.max(8, Math.min(rawLeft, window.innerWidth - formW - 8)),
                top: Math.max(8, Math.min(rawTop, window.innerHeight - formH - 8)),
                width: formW,
              };
            })()}
            onSubmit={(event) => { event.preventDefault(); commitText(); }}
          >
            <input
              autoFocus
              value={textBox.value}
              placeholder="Write on this section"
              onChange={(event) => setTextBox((prev) => ({ ...prev, value: event.target.value }))}
              onKeyDown={(event) => { if (event.key === "Escape") setTextBox(null); }}
            />
            <button type="submit">Add</button>
          </form>
        )}
        <footer className="wpr-mark-foot">
          <button type="button" className="wpr-mark-cancel" onClick={onCancel}>Cancel</button>
          <button type="button" className="wpr-mark-save" onClick={save} disabled={!ready || !!error}>Save marked image</button>
        </footer>
      </div>
    </div>
  );
}
