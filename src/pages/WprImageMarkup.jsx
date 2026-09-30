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
  const imgRef = useRef(null);
  const startRef = useRef(null);
  const draftRef = useRef(null);
  const toolRef = useRef("rect");
  const colorRef = useRef(COLORS[0]);
  const marksRef = useRef([]);
  const [ready, setReady] = useState(false);
  const [tool, setTool] = useState("rect");
  const [color, setColor] = useState(COLORS[0]);
  const [marks, setMarks] = useState([]);
  const [draft, setDraft] = useState(null);
  const [textBox, setTextBox] = useState(null);
  const [selectedText, setSelectedText] = useState(null);
  const [error, setError] = useState("");
  const dragRef = useRef(null);

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
    const maxW = Math.min(980, window.innerWidth - 48);
    const maxH = Math.min(620, window.innerHeight - 230);
    const scale = Math.min(maxW / img.width, maxH / img.height, 1);
    canvas.width = img.width;
    canvas.height = img.height;
    canvas.style.width = `${Math.round(img.width * scale)}px`;
    canvas.style.height = `${Math.round(img.height * scale)}px`;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0);
    [...marks, draft].filter(Boolean).forEach((mark, index) => drawMark(ctx, mark, index === selectedText));
  }, [ready, marks, draft, selectedText]);

  const strokeWidth = () => Math.max(4, (imgRef.current?.width || 800) * 0.004);
  const textSize = () => Math.max(22, Math.round((imgRef.current?.width || 800) * 0.028));

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
    if (dragRef.current) {
      const point = pointFrom(event);
      const { index, dx, dy } = dragRef.current;
      setMarks((prev) => prev.map((mark, item) => (
        item === index ? { ...mark, x: point.x - dx, y: point.y - dy } : mark
      )));
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

  const onPointerUp = () => {
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
          index === textBox.editIndex ? { ...mark, text: value } : mark
        )));
        setSelectedText(textBox.editIndex);
      } else {
        setSelectedText(marksRef.current.length);
        setMarks((prev) => [
          ...prev,
          {
            type: "text",
            x: textBox.x,
            y: textBox.y,
            text: value,
            color: colorRef.current,
            size: textSize(),
          },
        ]);
      }
    }
    setTextBox(null);
  };

  const resizeText = (delta) => {
    if (selectedText == null) return;
    setMarks((prev) => prev.map((mark, index) => {
      if (index !== selectedText || mark.type !== "text") return mark;
      return { ...mark, size: Math.min(140, Math.max(16, (mark.size || textSize()) + delta)) };
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
      list = marks.map((mark, index) => (index === textBox.editIndex ? { ...mark, text: pending } : mark));
    } else if (pending) {
      list = [...marks, { type: "text", x: textBox.x, y: textBox.y, text: pending, color, size: textSize() }];
    }
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
            <p>Squares and circles stay lightly filled. Drag a note to move it, or double-click it to edit the words.</p>
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
          <button type="button" className="wpr-mark-tool" onClick={() => resizeText(-4)} disabled={selectedText == null}>Smaller</button>
          <button type="button" className="wpr-mark-tool" onClick={() => resizeText(4)} disabled={selectedText == null}>Larger</button>
          <button type="button" className="wpr-mark-tool" onClick={editSelectedText} disabled={selectedText == null}>Edit text</button>
          <button type="button" className="wpr-mark-tool" onClick={() => { setMarks((prev) => prev.slice(0, -1)); setSelectedText(null); }} disabled={!marks.length}>Undo</button>
          <button type="button" className="wpr-mark-tool" onClick={() => { setMarks([]); setDraft(null); }} disabled={!marks.length}>Clear</button>
        </div>
        <div className="wpr-mark-stage">
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
            style={{ left: textBox.left, top: textBox.top }}
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
