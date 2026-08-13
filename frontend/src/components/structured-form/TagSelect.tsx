interface TagSelectProps {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
  hint?: string;
  required?: boolean;
}

export function TagSelect({ label, value, options, onChange, hint, required }: TagSelectProps) {
  return (
    <div>
      <label className="block text-sm font-semibold text-indigo-950 mb-1.5">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {hint && <p className="text-xs text-gray-400 mb-2">{hint}</p>}
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(opt)}
            className={'px-3.5 py-1.5 text-sm rounded-lg border transition-all duration-200 cursor-pointer ' + (
              value === opt
                ? 'bg-[#4338CA] text-white border-[#4338CA] shadow-sm'
                : 'bg-white text-gray-600 border-gray-200 hover:border-[#4338CA] hover:text-[#4338CA]'
            )}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  );
}
