# BATCHLY DESIGN SYSTEM

## Overview
This design system ensures consistent UI/UX patterns across the Batchly ERP application. All components should follow these guidelines to maintain visual coherence and professional appearance.

## Color System

### Semantic Tokens (Always Use These)
```css
/* Primary Colors */
--primary: 222.2 47.4% 11.2%
--primary-foreground: 210 40% 98%

/* Secondary Colors */
--secondary: 210 40% 96.1%
--secondary-foreground: 222.2 47.4% 11.2%

/* Accent Colors */
--accent: 210 40% 96.1%
--accent-foreground: 222.2 47.4% 11.2%

/* Status Colors */
--destructive: 0 84.2% 60.2%
--muted: 210 40% 96.1%
--muted-foreground: 215.4 16.3% 46.9%
```

### Chart Color Palette
```typescript
const chartColors = {
  primary: "hsl(var(--primary))",
  secondary: "hsl(var(--secondary))",
  accent: "hsl(var(--accent))",
  success: "hsl(142 76% 36%)",
  warning: "hsl(38 92% 50%)",
  danger: "hsl(var(--destructive))",
  info: "hsl(199 89% 48%)",
  neutral: "hsl(var(--muted-foreground))"
}
```

## Component Patterns

### 1. Stat Cards
**Pattern**: Icon + Title + Value + Trend Indicator
```tsx
<Card className="p-6">
  <div className="flex items-center justify-between">
    <div className="flex items-center space-x-2">
      <div className="p-2 rounded-lg bg-primary/10">
        <Icon className="h-4 w-4 text-primary" />
      </div>
      <div>
        <p className="text-sm text-muted-foreground">{title}</p>
        <p className="text-2xl font-bold">{value}</p>
      </div>
    </div>
    <div className="text-right">
      <p className="text-sm text-green-600">+{trend}%</p>
      <p className="text-xs text-muted-foreground">vs last month</p>
    </div>
  </div>
</Card>
```

### 2. Chart Containers
**Pattern**: Title + Chart + Legend
```tsx
<Card className="p-6">
  <div className="space-y-4">
    <div>
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
    <div className="h-[300px]">
      <ResponsiveContainer width="100%" height="100%">
        {/* Chart Component */}
      </ResponsiveContainer>
    </div>
  </div>
</Card>
```

### 3. Status Badges
**Usage**: Order status, payment status, etc.
```tsx
const statusStyles = {
  completed: "bg-green-100 text-green-800",
  pending: "bg-yellow-100 text-yellow-800", 
  cancelled: "bg-red-100 text-red-800",
  draft: "bg-gray-100 text-gray-800"
}

<Badge className={statusStyles[status]}>{status}</Badge>
```

### 4. Quick Action Cards
**Pattern**: Icon + Title + Description + Action Button
```tsx
<Card className="p-6 hover:shadow-md transition-shadow">
  <div className="space-y-4">
    <div className="flex items-center space-x-2">
      <Icon className="h-5 w-5 text-primary" />
      <h3 className="font-semibold">{title}</h3>
    </div>
    <p className="text-sm text-muted-foreground">{description}</p>
    <Button variant="outline" size="sm">{actionText}</Button>
  </div>
</Card>
```

## Layout Patterns

### 1. Dashboard Grid
```tsx
<div className="space-y-6">
  {/* Stats Row */}
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
    {/* Stat Cards */}
  </div>
  
  {/* Charts Row */}
  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
    {/* Chart Cards */}
  </div>
  
  {/* Additional Content */}
  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
    {/* Mixed Content */}
  </div>
</div>
```

### 2. Page Header Pattern
```tsx
<div className="space-y-4">
  <div className="flex items-center justify-between">
    <div>
      <h1 className="text-2xl font-bold">{pageTitle}</h1>
      <p className="text-muted-foreground">{pageDescription}</p>
    </div>
    <div className="flex items-center space-x-2">
      {/* Action buttons */}
    </div>
  </div>
</div>
```

## Chart Standards

### 1. Chart Configuration
```typescript
const defaultChartConfig = {
  height: 300,
  margin: { top: 20, right: 30, left: 20, bottom: 5 },
  colors: chartColors,
  tooltipConfig: {
    contentStyle: {
      backgroundColor: "hsl(var(--card))",
      border: "1px solid hsl(var(--border))",
      borderRadius: "6px"
    }
  }
}
```

### 2. Responsive Chart Container
```tsx
<div className="h-[300px]">
  <ResponsiveContainer width="100%" height="100%">
    {/* Chart Component */}
  </ResponsiveContainer>
</div>
```

### 3. Chart Legend Positioning
- **Line Charts**: Bottom center
- **Pie Charts**: Right side
- **Bar Charts**: Bottom center

## Typography Scale

### Headings
```css
.heading-1 { @apply text-2xl font-bold; }
.heading-2 { @apply text-xl font-semibold; }
.heading-3 { @apply text-lg font-semibold; }
.heading-4 { @apply text-base font-medium; }
```

### Body Text
```css
.body-large { @apply text-base; }
.body-normal { @apply text-sm; }
.body-small { @apply text-xs; }
.caption { @apply text-xs text-muted-foreground; }
```

## Spacing System

### Card Padding
- **Standard Cards**: `p-6`
- **Compact Cards**: `p-4`
- **Dense Cards**: `p-3`

### Grid Gaps
- **Desktop**: `gap-6`
- **Tablet**: `gap-4`
- **Mobile**: `gap-3`

### Element Spacing
- **Between sections**: `space-y-6`
- **Between related items**: `space-y-4`
- **Between tight items**: `space-y-2`

## Interactive Patterns

### 1. Hover Effects
```css
/* Cards */
.hover-card { @apply hover:shadow-md transition-shadow; }

/* Buttons */
.hover-button { @apply hover:opacity-80 transition-opacity; }
```

### 2. Loading States
```tsx
<div className="flex items-center justify-center h-[300px]">
  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
</div>
```

### 3. Empty States
```tsx
<div className="text-center py-12">
  <div className="mx-auto h-12 w-12 text-muted-foreground">
    <Icon className="h-full w-full" />
  </div>
  <h3 className="mt-4 text-lg font-semibold">No data available</h3>
  <p className="mt-2 text-sm text-muted-foreground">{description}</p>
  <Button className="mt-4" variant="outline">{actionText}</Button>
</div>
```

## Form Patterns

### 1. Form Layout
```tsx
<div className="space-y-6">
  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
    {/* Form fields */}
  </div>
  <div className="flex justify-end space-x-2">
    <Button variant="outline">Cancel</Button>
    <Button type="submit">Save</Button>
  </div>
</div>
```

### 2. Input Groups
```tsx
<div className="space-y-2">
  <Label htmlFor={id}>{label}</Label>
  <Input id={id} {...props} />
  {error && <p className="text-sm text-destructive">{error}</p>}
</div>
```

## Implementation Guidelines

### DO's
- ✅ Always use semantic color tokens
- ✅ Follow the card pattern structure
- ✅ Use consistent spacing values
- ✅ Apply hover effects to interactive elements
- ✅ Include loading and empty states
- ✅ Make charts responsive with ResponsiveContainer

### DON'Ts
- ❌ Never use direct color values (e.g., #ffffff, blue-500)
- ❌ Don't mix different card padding sizes within the same view
- ❌ Avoid inconsistent grid gaps
- ❌ Don't forget hover states on clickable elements
- ❌ Never hardcode chart dimensions

## Component Library Checklist

When creating new components, ensure:
- [ ] Uses semantic color tokens
- [ ] Follows established spacing patterns
- [ ] Includes proper TypeScript types
- [ ] Has consistent hover/focus states
- [ ] Supports responsive design
- [ ] Includes loading/error states where applicable
- [ ] Follows the established naming conventions

## Future Enhancements

### Phase 2 Additions
- Data table patterns
- Form validation styling
- Modal/dialog standards
- Navigation patterns

### Phase 3 Additions
- Animation standards
- Mobile-specific patterns
- Advanced chart configurations
- Theme switching support