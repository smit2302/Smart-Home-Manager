import { useEffect, useState } from 'react';
import { getFieldRange } from '../utils/deviceTemplates.js';

function RangeControl({ field, range, value, disabled, onCommit }) {
  const [draftValue, setDraftValue] = useState(value);
  useEffect(() => setDraftValue(value), [value]);

  return (
    <label className="control-row">
      <span className="control-label">
        {field.label}
        <strong>
          {draftValue}
          {field.unit}
        </strong>
      </span>
      <input
        type="range"
        min={range.min}
        max={range.max}
        value={draftValue}
        disabled={disabled}
        onChange={(event) => setDraftValue(Number(event.target.value))}
        onPointerUp={(event) => onCommit(Number(event.target.value))}
        onKeyUp={(event) => onCommit(Number(event.target.value))}
        onTouchEnd={(event) => onCommit(Number(event.target.value))}
      />
    </label>
  );
}

function ChoiceControl({ field, value, disabled, onPick }) {
  return (
    <div className="control-row">
      <span className="control-label">{field.label}</span>
      <div className="segmented" role="group" aria-label={field.label}>
        {field.options.map((option) => (
          <button
            key={option}
            type="button"
            disabled={disabled}
            className={option === value ? 'segment segment-active' : 'segment'}
            onClick={() => onPick(option)}
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function DeviceControls({ device, template, disabled, onChange }) {
  return (
    <div className="controls">
      {template.fields.map((field) =>
        field.kind === 'range' ? (
          <RangeControl
            key={field.key}
            field={field}
            range={getFieldRange(device, field)}
            value={device.settings[field.key]}
            disabled={disabled}
            onCommit={(next) => next !== device.settings[field.key] && onChange(field.key, next)}
          />
        ) : (
          <ChoiceControl
            key={field.key}
            field={field}
            value={device.settings[field.key]}
            disabled={disabled}
            onPick={(next) => onChange(field.key, next)}
          />
        ),
      )}
    </div>
  );
}
