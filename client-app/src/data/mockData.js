// CivixAI — static UI configuration (no mock data)
// All issue/user/task data comes from the real backend API via ClientContext.

export const categoryIcons = {
  Road: '🛣️',
  Water: '💧',
  Electricity: '⚡',
  Garbage: '🗑️',
  Traffic: '🚦',
  'Public Facilities': '🏛️',
};

// Hex values for React Native (no Tailwind)
export const categoryColors = {
  Road:               { bg: '#dbeafe', text: '#1d4ed8' },
  Water:              { bg: '#e0f2fe', text: '#0369a1' },
  Electricity:        { bg: '#fef9c3', text: '#a16207' },
  Garbage:            { bg: '#dcfce7', text: '#15803d' },
  Traffic:            { bg: '#fae8ff', text: '#7e22ce' },
  'Public Facilities':{ bg: '#fce7f3', text: '#9d174d' },
};

export const statusConfig = {
  Submitted:     { bg: '#f3f4f6', text: '#4b5563', dot: '#9ca3af', label: 'Submitted'   },
  Assigned:      { bg: '#dbeafe', text: '#1d4ed8', dot: '#3b82f6', label: 'Assigned'    },
  'In Progress': { bg: '#fef9c3', text: '#a16207', dot: '#eab308', label: 'In Progress' },
  Resolved:      { bg: '#dcfce7', text: '#15803d', dot: '#22c55e', label: 'Resolved'    },
  Closed:        { bg: '#f1f5f9', text: '#475569', dot: '#94a3b8', label: 'Closed'      },
};
