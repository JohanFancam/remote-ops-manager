import React from 'react';

export default function FilePickerButton({
  id,
  accept,
  disabled,
  onChange,
  children,
  className = '',
}) {
  return (
    <span className="inline-flex">
      <input
        id={id}
        type="file"
        accept={accept}
        disabled={disabled}
        onChange={onChange}
        className="hidden"
      />
      <label
        htmlFor={disabled ? undefined : id}
        className={`inline-flex h-8 items-center gap-2 rounded-md bg-orange-500 px-3 text-xs font-medium text-white hover:bg-orange-400 ${
          disabled ? 'pointer-events-none opacity-50' : 'cursor-pointer'
        } ${className}`}
      >
        {children}
      </label>
    </span>
  );
}
