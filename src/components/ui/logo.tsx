export function Logo({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="#f0453e"
      className={className}
      aria-hidden="true"
    >
      <path d="M15.827 2.761A10 10 0 1 1 8.173 2.761L10.852 9.228A3 3 0 1 0 13.148 9.228Z" />
    </svg>
  )
}
