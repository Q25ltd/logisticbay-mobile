/**
 * Barrel export for all shared mobile UI components.
 *
 * Import from here: import { Button, Card } from "../components";
 */
export { Button }        from "./Button";
export { Card }          from "./Card";
export { SectionHeader } from "./SectionHeader";
export { LabelValue }    from "./LabelValue";
export { Badge }         from "./Badge";
export { AppFooter }     from "./AppFooter";

// Re-export COLOURS for files that imported them from the old components.tsx.
// New files should import from "../theme" directly.
export { COLOURS } from "../theme";
