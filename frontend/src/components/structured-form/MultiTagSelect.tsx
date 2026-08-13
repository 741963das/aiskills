interface MultiTagSelectProps {
  label: string;
  value: string[];
  options: string[];
  onChange: (value: string[]) => void;
  maxSelect?: number;
  hint?: string;
  required?: boolean;
}

export function MultiTagSelect({ label, value, options, onChange, maxSelect, hint, required }: MultiTagSelectProps) {
  const toggle = (opt: string) => {
    if (value.includes(opt)) {
      onChange(value.filter((v) => v !== opt));
    } else {
      if (maxSelect && value.length >= maxSelect) return;
      onChange([...value, opt]);
    }
  };

  return (
    <div>
      <label className="block text-sm font-semibold text-indigo-950 mb-1.5">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
        {maxSelect && (
          <span className="ml-2 text-xs font-normal text-gray-400">
            已选 {value.length}/{maxSelect}
          </span>
        )}
      </label>
      {hint && <p className="text-xs text-gray-400 mb-2">{hint}</p>}
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => {
          const selected = value.includes(opt);
          const disabled = !selected && maxSelect !== undefined && value.length >= maxSelect;
          return (
            <button
              key={opt}
              type="button"
              onClick={() => toggle(opt)}
              disabled={disabled}
              className={'px-3.5 py-1.5 text-sm rounded-lg border transition-all duration-200 cursor-pointer ' + (
                selected
                  ? 'bg-[#4338CA] text-white border-[#4338CA] shadow-sm'
                  : disabled
                    ? 'bg-gray-50 text-gray-300 border-gray-100 cursor-not-allowed'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-[#4338CA] hover:text-[#4338CA]'
              )}
            >
              {selected && <span className="mr-1">✓</span>}
              {opt}
            </button>
          );
        })}
      </div>
    </div>
  );
}
