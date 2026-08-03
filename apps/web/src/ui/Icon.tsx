import type { ReactNode, SVGProps } from 'react'

interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'className' | 'children'> {
  size?: number
  className?: string
  children?: ReactNode
}

/**
 * Base <svg> shell every concrete icon below renders through: stroke-based, square,
 * `currentColor` (inherits whatever text color classes wrap it), decorative by
 * default. Same viewBox/stroke conventions `react-native-svg` expects, so a port
 * only needs to swap the element, not the path data.
 */
export function Icon({ size = 20, className = '', children, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      {...rest}
    >
      {children}
    </svg>
  )
}

type ConcreteIconProps = Omit<IconProps, 'children'>

export function ChevronLeftIcon(props: ConcreteIconProps) {
  return (
    <Icon {...props}>
      <path d="M15 18l-6-6 6-6" />
    </Icon>
  )
}

export function InfoIcon(props: ConcreteIconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5" />
      <path d="M12 8h.01" />
    </Icon>
  )
}

export function PencilIcon(props: ConcreteIconProps) {
  return (
    <Icon {...props}>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </Icon>
  )
}

export function UndoIcon(props: ConcreteIconProps) {
  return (
    <Icon {...props}>
      <path d="M9 14 4 9l5-5" />
      <path d="M4 9h11a5 5 0 0 1 0 10H9" />
    </Icon>
  )
}

export function CloseIcon(props: ConcreteIconProps) {
  return (
    <Icon {...props}>
      <path d="M18 6 6 18" />
      <path d="M6 6l12 12" />
    </Icon>
  )
}

export function SearchIcon(props: ConcreteIconProps) {
  return (
    <Icon {...props}>
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" />
    </Icon>
  )
}

export function PlusIcon(props: ConcreteIconProps) {
  return (
    <Icon {...props}>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </Icon>
  )
}

export function TrashIcon(props: ConcreteIconProps) {
  return (
    <Icon {...props}>
      <path d="M4 7h16" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
      <path d="M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12" />
      <path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
    </Icon>
  )
}

export function ShuffleIcon(props: ConcreteIconProps) {
  return (
    <Icon {...props}>
      <path d="M16 3h5v5" />
      <path d="M4 20 21 3" />
      <path d="M21 16v5h-5" />
      <path d="M15 15l6 6" />
      <path d="M4 4l5 5" />
    </Icon>
  )
}

export function ChevronUpIcon(props: ConcreteIconProps) {
  return (
    <Icon {...props}>
      <path d="M18 15l-6-6-6 6" />
    </Icon>
  )
}

export function ChevronDownIcon(props: ConcreteIconProps) {
  return (
    <Icon {...props}>
      <path d="M6 9l6 6 6-6" />
    </Icon>
  )
}

export function TrophyIcon(props: ConcreteIconProps) {
  return (
    <Icon {...props}>
      <path d="M8 21h8" />
      <path d="M12 17v4" />
      <path d="M7 4h10v5a5 5 0 0 1-10 0V4Z" />
      <path d="M7 6H4v2a3 3 0 0 0 3 3" />
      <path d="M17 6h3v2a3 3 0 0 1-3 3" />
    </Icon>
  )
}

export function SpeakerIcon(props: ConcreteIconProps) {
  return (
    <Icon {...props}>
      <path d="M11 5 6 9H3v6h3l5 4V5Z" />
      <path d="M15.5 8.5a5 5 0 0 1 0 7" />
      <path d="M18.5 6a9 9 0 0 1 0 12" />
    </Icon>
  )
}

export function SpeakerOffIcon(props: ConcreteIconProps) {
  return (
    <Icon {...props}>
      <path d="M11 5 6 9H3v6h3l5 4V5Z" />
      <path d="M22 9l-6 6" />
      <path d="M16 9l6 6" />
    </Icon>
  )
}
