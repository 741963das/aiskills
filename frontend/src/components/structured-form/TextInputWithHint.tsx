interface TextInputWithHintProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  hint?: string;
  suggestions?: string[];
  required?: boolean;
  multiline?: boolean;
}

export function TextInputWithHint({
  label,
  value,
  onChange,
  placeholder,
  hint,
  suggestions,
  required,
  multiline,
}: TextInputWithHintProps) {
  const listId = suggestions && suggestions.length > 0 ? `dl-${label.replace(/\s/g, '-')}` : undefined;

  return (
    <div>
      <label className="block text-sm font-semibold text-indigo-950 mb-1.5">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
        {!required && <span className="ml-1.5 text-xs font-normal text-gray-400">推荐填写</span>}
      </label>
      {hint && <p className="text-xs text-gray-400 mb-2">{hint}</p>}
      {multiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={3}
          className="w-full px-3.5 py-2.5 text-sm border border-gray-200 rounded-lg bg-white focus:border-[#4338CA] focus:ring-2 focus:ring-indigo-100 outline-none transition-all resize-none"
        />
      ) : (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          list={listId}
          className="w-full px-3.5 py-2.5 text-sm border border-gray-200 rounded-lg bg-white focus:border-[#4338CA] focus:ring-2 focus:ring-indigo-100 outline-none transition-all"
        />
      )}
      {listId && (
        <datalist id={listId}>
          {suggestions!.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      )}
    </div>
  );
}
