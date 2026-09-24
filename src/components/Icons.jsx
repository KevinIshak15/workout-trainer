const base = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
}

export const DumbbellIcon = ({ className }) => (
  <svg className={className} {...base}>
    <path d="M6.5 6.5a2 2 0 0 1 3 0l8 8a2 2 0 0 1-3 3l-8-8a2 2 0 0 1 0-3z" />
    <path d="m14 4 2 2" /><path d="m20 10-2-2" /><path d="m4 14 2-2" /><path d="m10 20-2-2" />
  </svg>
)

export const ClipboardIcon = ({ className }) => (
  <svg className={className} {...base}>
    <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
    <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
    <path d="M12 11h4" /><path d="M12 16h4" /><path d="M8 11h.01" /><path d="M8 16h.01" />
  </svg>
)

export const TrendingIcon = ({ className }) => (
  <svg className={className} {...base}>
    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
    <polyline points="17 6 23 6 23 12" />
  </svg>
)

export const ClockIcon = ({ className }) => (
  <svg className={className} {...base}>
    <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
  </svg>
)

export const TrashIcon = ({ className }) => (
  <svg className={className} {...base}>
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    <line x1="10" y1="11" x2="10" y2="17" /><line x1="14" y1="11" x2="14" y2="17" />
  </svg>
)

export const CheckIcon = ({ className }) => (
  <svg className={className} {...base} strokeWidth={3}>
    <polyline points="20 6 9 17 4 12" />
  </svg>
)

export const ChevronRightIcon = ({ className }) => (
  <svg className={className} {...base}><polyline points="9 18 15 12 9 6" /></svg>
)

export const ChevronLeftIcon = ({ className }) => (
  <svg className={className} {...base}><polyline points="15 18 9 12 15 6" /></svg>
)

export const CloseIcon = ({ className }) => (
  <svg className={className} {...base}>
    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
  </svg>
)

export const PlusIcon = ({ className }) => (
  <svg className={className} {...base}>
    <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
  </svg>
)

export const TrophyIcon = ({ className }) => (
  <svg className={className} {...base}>
    <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
    <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
    <path d="M4 22h16" />
    <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
    <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
    <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
  </svg>
)

export const ArrowUpIcon = ({ className }) => (
  <svg className={className} {...base}><line x1="12" y1="19" x2="12" y2="5" /><polyline points="5 12 12 5 19 12" /></svg>
)

export const ArrowDownIcon = ({ className }) => (
  <svg className={className} {...base}><line x1="12" y1="5" x2="12" y2="19" /><polyline points="19 12 12 19 5 12" /></svg>
)

export const DownloadIcon = ({ className }) => (
  <svg className={className} {...base}>
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
  </svg>
)
