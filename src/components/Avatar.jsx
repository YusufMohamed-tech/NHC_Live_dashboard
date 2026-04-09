const sizeMap = {
  sm: 'h-9 w-9 text-sm',
  md: 'h-11 w-11 text-base',
  lg: 'h-14 w-14 text-lg',
}

function getInitials(name = '') {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0] ?? '')
    .join('')
}

export default function Avatar({ name, size = 'md', className = '' }) {
  return (
    <div
      className={`inline-flex items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-fuchsia-500 font-bold text-white ${sizeMap[size]} ${className}`}
      aria-label={`صورة ${name}`}
    >
      {getInitials(name)}
    </div>
  )
}
