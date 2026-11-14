import { useId, useState } from 'react';

// Keep an editing draft so clearing a field or typing '-' / an exponent is possible.
export function RangeNumber({ label, value, onChange, min, max, step = 0.01 }) {
    const id = useId();
    const [draft, setDraft] = useState(null);
    const commit = () => {
        if (draft !== null && draft.value === value && draft.text.trim() !== '' && Number.isFinite(Number(draft.text))) {
            const next = Math.min(max, Math.max(min, Number(draft.text)));
            if (next !== value) onChange(next);
        }
        setDraft(null);
    };
    return (
        <div className="range-number">
            <label htmlFor={id}>{label}</label>
            <input aria-label={`${label}: слайдер`} type="range" min={min} max={max} step={step} value={value}
                onChange={(e) => { setDraft(null); onChange(Number(e.target.value)); }} />
            <input id={id} className="sim-value-input" type="number" min={min} max={max} step="any"
                value={draft?.value === value ? draft.text : value}
                onChange={(e) => {
                    const raw = e.target.value;
                    const n = Number(raw);
                    const valid = raw.trim() !== '' && Number.isFinite(n) && n >= min && n <= max;
                    setDraft({ text: raw, value: valid ? n : value });
                    if (valid && n !== value) onChange(n);
                }}
                onBlur={commit}
                onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }} />
        </div>
    );
}
