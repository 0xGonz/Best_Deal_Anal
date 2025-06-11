/**
 * Spacing Constants
 * Standardized spacing values to maintain consistent layout rhythm throughout the application
 */

// Base spacing unit in pixels (for reference only - we'll use rem units)
export const BASE_SPACING_UNIT = 4; // 4px

// Spacing scale (in rem units)
export const SPACING = {
  // Extra small spacing (4px)
  XS: '0.25rem',
  // Small spacing (8px)
  SM: '0.5rem',
  // Medium spacing (12px)
  MD: '0.75rem',
  // Base spacing (16px)
  BASE: '1rem',
  // Large spacing (24px)
  LG: '1.5rem',
  // Extra large spacing (32px)
  XL: '2rem',
  // 2x Extra large spacing (48px)
  XXL: '3rem',
  // 3x Extra large spacing (64px)
  XXXL: '4rem',
} as const;

// Responsive padding patterns
export const PADDING = {
  CARD: {
    // Card content padding
    CONTENT: 'p-3 sm:p-4 md:p-6',
    // Card header padding
    HEADER: 'px-4 py-3 sm:px-6 sm:py-4',
    // Card footer padding
    FOOTER: 'p-3 sm:p-4 md:p-5',
    // Responsive padding for cards (scales with screen size)
    RESPONSIVE: 'pt-3 xs:pt-4 sm:pt-6 p-2 xs:p-3 sm:p-6',
  },
  LAYOUT: {
    // Page content padding
    PAGE: 'p-2 sm:p-4 lg:p-6',
    // Container padding
    CONTAINER: 'px-2 sm:px-4 md:px-6 py-2 sm:py-4',
    // Section padding
    SECTION: 'py-3 sm:py-4 md:py-6',
  },
  FORM: {
    // Form container padding
    CONTAINER: 'p-3 sm:p-4 md:p-5',
    // Form field group padding
    FIELD_GROUP: 'py-2 sm:py-3',
  },
  ICON: {
    // Responsive padding for icons
    RESPONSIVE: 'p-1 xs:p-1.5 sm:p-2.5',
  },
} as const;

// Responsive margin patterns
export const MARGIN = {
  LAYOUT: {
    // Space between sections
    SECTION: 'mb-6 sm:mb-8 md:mb-10',
    // Space between components
    COMPONENT: 'mb-4 sm:mb-6',
    // Space between related elements
    ELEMENT: 'mb-2 sm:mb-3 md:mb-4',
  },
  // Space between card elements
  CARD: {
    // Card title to content
    TITLE_TO_CONTENT: 'mb-3 sm:mb-4',
    // Space between card sections
    SECTION: 'mb-3 sm:mb-4',
    // Space between card items
    ITEM: 'mb-2 sm:mb-3',
    // Space below card header
    HEADER: 'mb-1 xs:mb-2 sm:mb-3',
  },
  // Space between form elements
  FORM: {
    // Form section margin
    SECTION: 'mb-4 sm:mb-6',
    // Form field margin
    FIELD: 'mb-3 sm:mb-4',
  },
} as const;

// Gap values for grid and flexbox layouts
export const GAP = {
  // Extra small gap (4px)
  XS: 'gap-1',
  // Small gap (8px)
  SM: 'gap-2',
  // Medium gap (12px) with responsive variants
  MD: 'gap-3 sm:gap-4',
  // Large gap (16px+) with responsive variants
  LG: 'gap-4 sm:gap-6',
  // Extra large gap with responsive variants
  XL: 'gap-6 sm:gap-8 md:gap-10',
} as const;
