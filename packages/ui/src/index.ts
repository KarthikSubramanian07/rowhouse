/**
 * @rowhouse/ui: the Rowhouse design system.
 * Import styles once in the app:
 *   import '@rowhouse/ui/styles.css';
 */

export { Avatar, type AvatarProps } from './components/Avatar.js';
export { Badge, type BadgeProps, badge } from './components/Badge.js';
// Primitives
export { Button, type ButtonProps, button } from './components/Button.js';
export {
  Card,
  CardBody,
  CardDescription,
  CardFooter,
  CardHeader,
  type CardProps,
  CardTitle,
} from './components/Card.js';
export {
  Dialog,
  DialogClose,
  DialogContent,
  type DialogContentProps,
  DialogDescription,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
} from './components/Dialog.js';
export {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './components/DropdownMenu.js';
export { Field, type FieldProps } from './components/Field.js';
export { Input, type InputProps } from './components/Input.js';
export { LiveBadge, type LiveBadgeProps } from './components/LiveBadge.js';
export { ReactionBar, type ReactionBarProps } from './components/ReactionBar.js';
export { Spinner, type SpinnerProps } from './components/Spinner.js';
export { SyncLock, type SyncLockProps, type SyncStatus } from './components/SyncLock.js';
export { Tabs, TabsContent, TabsList, TabsTrigger } from './components/Tabs.js';
// Signature components
export { TimeCode, type TimeCodeProps } from './components/TimeCode.js';
// Toasts (re-exported from sonner, themed)
export { Toaster, type ToasterProps, toast } from './components/Toaster.js';
export {
  Tooltip,
  TooltipContent,
  type TooltipProps,
  TooltipProvider,
  TooltipRoot,
  TooltipTrigger,
} from './components/Tooltip.js';
export { Waveform, type WaveformProps } from './components/Waveform.js';
export {
  Logo,
  type LogoProps,
  Wordmark,
  type WordmarkProps,
} from './components/Wordmark.js';
// Utilities
export { type ClassValue, cn } from './lib/cn.js';
export { REACTION_COLORS, REACTION_LABELS } from './lib/reactions.js';
